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

type InMessage = StartMessage | StopMessage;

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

const HEARTBEAT_MS = 60_000;
const PING_COOLDOWN_MS = 1000;
const MAX_PROCESSED_JOBS = 1000;

let client: ElisymClient | null = null;
let identity: ElisymIdentity | null = null;
let caps: { card: CapabilityCard; dTag: string }[] = [];

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let dmSub: SubCloser | null = null;
let jobSub: SubCloser | null = null;
const paymentSubs: SubCloser[] = [];
const processedJobs = new Set<string>();
const lastPings = new Map<string, number>();
let consecutiveErrors = 0;

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
      if (now - last < PING_COOLDOWN_MS) return;
      lastPings.set(senderPubkey, now);

      client!.messaging
        .sendPong(identity!, senderPubkey, nonce)
        .catch(console.error);
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
  closeSubs();

  if (client) {
    try { client.close(); } catch { /* ignore */ }
    client = null;
  }

  client = new ElisymClient();
  setupSubscriptions();
  log("Reconnected to relays");
}

// --------------- Cleanup ---------------

function cleanup() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  closeSubs();
  processedJobs.clear();
  lastPings.clear();
  consecutiveErrors = 0;

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
    } catch (e) {
      consecutiveErrors++;
      post({ type: "log", level: "error", message: `Heartbeat error (${consecutiveErrors}): ${e}` });
      if (consecutiveErrors >= 2) {
        restartConnection();
        consecutiveErrors = 0;
      }
    }
  };

  void publishHeartbeat();
  heartbeatInterval = setInterval(() => void publishHeartbeat(), HEARTBEAT_MS);
  log("Heartbeat started");

  // --- Subscriptions ---
  setupSubscriptions();

  // --- Recover pending jobs ---
  void recoverPendingJobs();
}

// --------------- Job Recovery ---------------

async function recoverPendingJobs() {
  if (!client || !identity) return;

  try {
    const myPubkey = identity.publicKey;
    const since = Math.floor(Date.now() / 1000) - 86400; // last 24h

    // 1. Fetch job requests addressed to us
    const requests = await client.pool.querySync({
      kinds: [5100],
      "#p": [myPubkey],
      since,
    } as Filter);

    if (requests.length === 0) return;

    const requestIds = requests.map((r) => r.id);

    // 2. Fetch feedback for these jobs
    const feedbacks = await client.pool.queryBatchedByTag(
      { kinds: [7000] } as Filter,
      "e",
      requestIds,
    );

    // 3. Find jobs with payment-completed
    const paidJobIds = new Set<string>();
    for (const fb of feedbacks) {
      const statusTag = fb.tags.find((t) => t[0] === "status");
      if (statusTag?.[1] !== "payment-completed") continue;
      const eTag = fb.tags.find((t) => t[0] === "e");
      if (eTag?.[1]) paidJobIds.add(eTag[1]);
    }

    // Also include free jobs (no payment feedback at all = no price)
    const jobsWithFeedback = new Set<string>();
    for (const fb of feedbacks) {
      const eTag = fb.tags.find((t) => t[0] === "e");
      if (eTag?.[1]) jobsWithFeedback.add(eTag[1]);
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

    // 5. Find undelivered jobs: paid but no result, or free (no feedback) and no result
    const pendingJobs = requests.filter((req) => {
      if (deliveredJobIds.has(req.id)) return false; // already delivered
      if (processedJobs.has(req.id)) return false; // already handled in this session
      // Paid but not delivered
      if (paidJobIds.has(req.id)) return true;
      // Free job (no payment feedback) — check if capability is free
      if (!jobsWithFeedback.has(req.id)) {
        const requestedTag = req.tags.find((t) => t[0] === "t" && t[1] !== "elisym")?.[1];
        const matchedCap = findCap(requestedTag);
        if (matchedCap && (matchedCap.card.payment?.job_price ?? 0) === 0) return true;
      }
      return false;
    });

    if (pendingJobs.length === 0) return;

    log(`Recovering ${pendingJobs.length} pending job(s)...`);

    for (const req of pendingJobs) {
      processedJobs.add(req.id);
      const requestedTag = req.tags.find((t) => t[0] === "t" && t[1] !== "elisym")?.[1];
      const matchedCap = findCap(requestedTag);
      if (!matchedCap) continue;

      const price = matchedCap.card.payment?.job_price ?? 0;
      try {
        await deliverResult(req, matchedCap.dTag, matchedCap.card.name, price);
        log(`Recovered job ${req.id.slice(0, 8)}...`);
      } catch (e) {
        post({ type: "log", level: "error", message: `Recovery failed for ${req.id.slice(0, 8)}...: ${e}` });
      }
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
  }
};
