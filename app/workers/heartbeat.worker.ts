import {
  ElisymClient,
  ElisymIdentity,
  PaymentService,
  type CapabilityCard,
} from "@elisym/sdk";
import type { Filter, Event } from "nostr-tools";

// --------------- IndexedDB (inline, no DOM deps) ---------------

const DB_NAME = "elisym-cache";
const STORE_NAME = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

async function cacheGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

// --------------- Types ---------------

type SubCloser = { close: (reason?: string) => void };

interface StartMessage {
  type: "start";
  secretKeyHex: string;
  capabilities: { card: CapabilityCard; dTag: string }[];
}

interface StopMessage {
  type: "stop";
}

interface ReconnectMessage {
  type: "reconnect";
}

type InMessage = StartMessage | StopMessage | ReconnectMessage;

interface LogMessage {
  type: "log";
  level: "info" | "error";
  message: string;
}

interface SaleMessage {
  type: "sale";
  capabilityName: string;
  amount: number; // lamports
}

type OutMessage = LogMessage | SaleMessage;

// --------------- State ---------------

const HEARTBEAT_MS = 600_000;
const PING_COOLDOWN_MS = 1000;
const MAX_PROCESSED_JOBS = 1000;
const SUSPEND_CHECK_MS = 10_000;    // check every 10s
const SUSPEND_DRIFT_MS = 15_000;    // reconnect if timer drifted >15s

let client: ElisymClient | null = null;
let identity: ElisymIdentity | null = null;
let caps: { card: CapabilityCard; dTag: string }[] = [];

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let suspendCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastCheckTime = 0;
let dmSub: SubCloser | null = null;
let jobSub: SubCloser | null = null;
const paymentSubs: SubCloser[] = [];
const processedJobs = new Set<string>();
const lastPings = new Map<string, number>();
let consecutiveErrors = 0;
let recoveryDone = false;
let isReconnecting = false;

function post(msg: OutMessage) {
  self.postMessage(msg);
}

function log(message: string) {
  post({ type: "log", level: "info", message });
}

// --------------- Subscriptions ---------------

function closeSubs() {
  if (dmSub) {
    dmSub.close();
    dmSub = null;
  }
  if (jobSub) {
    jobSub.close();
    jobSub = null;
  }
  for (const sub of paymentSubs) sub.close();
  paymentSubs.length = 0;
}

function findCap(tag: string | undefined) {
  if (!tag) return caps[0];
  const byDTag = caps.find((c) => c.dTag === tag);
  if (byDTag) return byDTag;
  return caps.find((c) => c.card.capabilities.includes(tag)) ?? caps[0];
}

async function deliverResult(requestEvent: Event, dTag: string, capName: string, amount: number) {
  const result = await cacheGet<string>(`capability-result:${dTag}`);
  const content = result || "No delivery content configured.";

  await client!.marketplace.submitJobResult(
    identity!,
    requestEvent,
    content,
    amount > 0 ? amount : undefined,
  );
  log(`Delivered result for ${requestEvent.id.slice(0, 8)}...`);
  post({ type: "sale", capabilityName: capName, amount });
}

async function handleJob(event: Event) {
  if (processedJobs.has(event.id)) return;
  processedJobs.add(event.id);
  if (processedJobs.size > MAX_PROCESSED_JOBS) processedJobs.clear();

  const requestedTag = event.tags.find((t) => t[0] === "t" && t[1] !== "elisym")?.[1];
  const matchedCap = findCap(requestedTag);
  if (!matchedCap) return;

  const price = matchedCap.card.payment?.job_price ?? 0;
  const walletAddress = matchedCap.card.payment?.address;

  log(`Job ${event.id.slice(0, 8)}... for ${matchedCap.card.name}`);

  if (price > 0 && walletAddress) {
    const paymentRequest = PaymentService.createPaymentRequest(walletAddress, price);
    const paymentRequestJson = JSON.stringify(paymentRequest);

    await client!.marketplace.submitPaymentRequiredFeedback(
      identity!,
      event,
      price,
      paymentRequestJson,
    );

    const paymentSub = client!.pool.subscribe(
      {
        kinds: [7000],
        "#e": [event.id],
        since: Math.floor(Date.now() / 1000) - 5,
      } as Filter,
      async (feedbackEv) => {
        const statusTag = feedbackEv.tags.find((t) => t[0] === "status");
        if (statusTag?.[1] !== "payment-completed") return;

        await deliverResult(event, matchedCap.dTag, matchedCap.card.name, price);
        paymentSub.close();
      },
    );
    paymentSubs.push(paymentSub);
  } else {
    await deliverResult(event, matchedCap.dTag, matchedCap.card.name, 0);
  }
}

function setupSubscriptions() {
  if (!client || !identity) return;

  // Ping/pong responder
  dmSub = client.messaging.subscribeToPings(
    identity,
    (senderPubkey: string, nonce: string) => {
      const now = Date.now();
      const last = lastPings.get(senderPubkey) ?? 0;
      if (now - last < PING_COOLDOWN_MS) {
        log(`Ping from ${senderPubkey.slice(0, 8)} throttled (cooldown)`);
        return;
      }
      lastPings.set(senderPubkey, now);

      log(`← Ping received from ${senderPubkey.slice(0, 8)} nonce=${nonce.slice(0, 8)}`);
      client!.messaging
        .sendPong(identity!, senderPubkey, nonce)
        .then(() => log(`→ Pong sent to ${senderPubkey.slice(0, 8)} nonce=${nonce.slice(0, 8)}`))
        .catch((err) => log(`✗ Pong failed to ${senderPubkey.slice(0, 8)}: ${err}`));
    },
  );
  log("Ping responder active");

  // Job handler
  jobSub = client.marketplace.subscribeToJobRequests(
    identity,
    [5100],
    (event) => void handleJob(event),
  );
  log("Job handler active");
}

// --------------- Reconnect ---------------

function restartConnection() {
  if (isReconnecting || !client) return;
  isReconnecting = true;

  closeSubs();
  client.pool.reset();
  setupSubscriptions();
  isReconnecting = false;
  log("Reconnected (pool reset)");
}

// --------------- Cleanup ---------------

function cleanup() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (suspendCheckInterval) {
    clearInterval(suspendCheckInterval);
    suspendCheckInterval = null;
  }
  closeSubs();
  processedJobs.clear();
  lastPings.clear();
  consecutiveErrors = 0;
  recoveryDone = false;
  isReconnecting = false;
  lastCheckTime = 0;

  if (client) {
    client.close();
    client = null;
  }
  identity = null;
  caps = [];
}

// --------------- Start ---------------

function start(msg: StartMessage) {
  cleanup();

  client = new ElisymClient();
  identity = ElisymIdentity.fromHex(msg.secretKeyHex);
  caps = msg.capabilities;

  if (caps.length === 0) {
    log("No capabilities — heartbeat idle");
    return;
  }

  // --- Heartbeat ---
  const lastCap = caps[caps.length - 1]!;

  const publishHeartbeat = async () => {
    try {
      await client!.discovery.publishCapability(identity!, lastCap.card);
      consecutiveErrors = 0;
      // Run recovery once after first successful heartbeat (relays confirmed connected)
      if (!recoveryDone) {
        recoveryDone = true;
        void recoverPendingJobs();
      }
    } catch (e) {
      consecutiveErrors++;
      post({ type: "log", level: "error", message: `Heartbeat error (${consecutiveErrors}): ${e}` });
      if (consecutiveErrors >= 1) {
        restartConnection();
        consecutiveErrors = 0;
      }
    }
  };

  void publishHeartbeat();
  heartbeatInterval = setInterval(() => void publishHeartbeat(), HEARTBEAT_MS);
  log("Heartbeat started");

  // --- Suspend detection ---
  // Detect when the browser/OS suspended the worker (e.g. background tab,
  // App Nap). If the timer fires much later than expected, WebSocket
  // connections are likely dead — reconnect immediately.
  lastCheckTime = Date.now();
  suspendCheckInterval = setInterval(() => {
    const now = Date.now();
    const drift = now - lastCheckTime - SUSPEND_CHECK_MS;
    lastCheckTime = now;
    if (drift > SUSPEND_DRIFT_MS) {
      log(`Detected suspension (drift ${Math.round(drift / 1000)}s), reconnecting...`);
      restartConnection();
      void publishHeartbeat();
    }
  }, SUSPEND_CHECK_MS);

  // --- Subscriptions ---
  setupSubscriptions();

  // Recovery runs automatically after first successful heartbeat
}

// --------------- Job Recovery ---------------

async function recoverPendingJobs() {
  if (!client || !identity) return;

  try {
    const myPubkey = identity.publicKey;
    const now = Math.floor(Date.now() / 1000);

    // 1. Fetch job requests addressed to us (last 24h)
    const requests = await client.pool.querySync({
      kinds: [5100],
      "#p": [myPubkey],
      since: now - 86400,
    } as Filter);

    if (requests.length === 0) return;

    const requestIds = requests.map((r) => r.id);

    // 2. Fetch all feedback for these jobs
    const feedbacks = await client.pool.queryBatchedByTag(
      { kinds: [7000] } as Filter,
      "e",
      requestIds,
    );

    // 3. Categorize feedback
    const paidJobIds = new Set<string>();      // customer sent payment-completed
    const ourFeedbackJobIds = new Set<string>(); // we (provider) sent any feedback
    for (const fb of feedbacks) {
      const eTag = fb.tags.find((t) => t[0] === "e")?.[1];
      if (!eTag) continue;

      if (fb.pubkey === myPubkey) {
        ourFeedbackJobIds.add(eTag);
      }

      const statusTag = fb.tags.find((t) => t[0] === "status");
      if (statusTag?.[1] === "payment-completed") {
        paidJobIds.add(eTag);
      }
    }

    // 4. Fetch results already delivered by us
    const results = await client.pool.queryBatchedByTag(
      { kinds: [6100], authors: [myPubkey] } as Filter,
      "e",
      requestIds,
    );

    const deliveredJobIds = new Set<string>();
    for (const r of results) {
      const eTag = r.tags.find((t) => t[0] === "e");
      if (eTag?.[1]) deliveredJobIds.add(eTag[1]);
    }

    let recovered = 0;

    // --- Pass 1: Delivery recovery (24h window) ---
    // Paid but not delivered, or free without result
    for (const req of requests) {
      if (deliveredJobIds.has(req.id) || processedJobs.has(req.id)) continue;

      const requestedTag = req.tags.find((t) => t[0] === "t" && t[1] !== "elisym")?.[1];
      const matchedCap = findCap(requestedTag);
      if (!matchedCap) continue;

      const price = matchedCap.card.payment?.job_price ?? 0;

      if (paidJobIds.has(req.id)) {
        // Paid but not delivered → deliver now
        processedJobs.add(req.id);
        try {
          await deliverResult(req, matchedCap.dTag, matchedCap.card.name, price);
          log(`Recovered paid job ${req.id.slice(0, 8)}...`);
          recovered++;
        } catch (e) {
          post({ type: "log", level: "error", message: `Recovery failed for ${req.id.slice(0, 8)}...: ${e}` });
        }
      } else if (price === 0 && !ourFeedbackJobIds.has(req.id)) {
        // Free job, no feedback from us, no result → deliver now
        processedJobs.add(req.id);
        try {
          await deliverResult(req, matchedCap.dTag, matchedCap.card.name, 0);
          log(`Recovered free job ${req.id.slice(0, 8)}...`);
          recovered++;
        } catch (e) {
          post({ type: "log", level: "error", message: `Recovery failed for ${req.id.slice(0, 8)}...: ${e}` });
        }
      }
    }

    // --- Pass 2: Payment request recovery (120s window) ---
    // Recent jobs where we never sent any feedback and capability is paid
    const recentCutoff = now - 120;
    for (const req of requests) {
      if (deliveredJobIds.has(req.id) || processedJobs.has(req.id)) continue;
      if (ourFeedbackJobIds.has(req.id)) continue; // we already responded
      if (paidJobIds.has(req.id)) continue; // already paid (handled above)
      if (req.created_at < recentCutoff) continue; // too old, customer likely gone

      const requestedTag = req.tags.find((t) => t[0] === "t" && t[1] !== "elisym")?.[1];
      const matchedCap = findCap(requestedTag);
      if (!matchedCap) continue;

      const price = matchedCap.card.payment?.job_price ?? 0;
      if (price === 0) continue; // free jobs handled in pass 1

      // Paid capability, no feedback from us → run full handleJob flow
      log(`Recovering recent job ${req.id.slice(0, 8)}... (sending payment request)`);
      void handleJob(req);
      recovered++;
    }

    if (recovered > 0) {
      log(`Recovery complete: ${recovered} job(s) processed`);
    }
  } catch (e) {
    post({ type: "log", level: "error", message: `Job recovery error: ${e}` });
  }
}

// --------------- Message handler ---------------

self.onmessage = (e: MessageEvent<InMessage>) => {
  switch (e.data.type) {
    case "start":
      start(e.data);
      break;
    case "stop":
      cleanup();
      log("Worker stopped");
      break;
    case "reconnect":
      if (client && identity && caps.length > 0) {
        const probeCap = caps[caps.length - 1]!;
        const PROBE_TIMEOUT = 3_000;
        const probe = client.discovery.publishCapability(identity, probeCap.card);
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), PROBE_TIMEOUT),
        );
        Promise.race([probe, timeout])
          .then(() => log("Connection probe OK"))
          .catch(() => {
            log("Connection probe failed, reconnecting...");
            restartConnection();
          });
      }
      break;
  }
};
