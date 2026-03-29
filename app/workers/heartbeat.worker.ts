import {
  ElisymClient,
  ElisymIdentity,
  PaymentService,
  PROTOCOL_TREASURY,
  KIND_JOB_REQUEST,
  KIND_JOB_RESULT,
  KIND_PING,
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
  rpcUrl: string;
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
let solanaRpcUrl = "";

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let suspendCheckInterval: ReturnType<typeof setInterval> | null = null;
let lastCheckTime = 0;
let dmSub: SubCloser | null = null;
let jobSub: SubCloser | null = null;
const paymentSubs: SubCloser[] = [];
const processedJobs = new Set<string>();
const verifyingJobs = new Set<string>();
const verificationAttempts = new Map<string, number>();
const MAX_VERIFICATION_ATTEMPTS = 3;
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

// --------------- Solana on-chain payment verification ---------------

interface PaymentRequestData {
  recipient: string;
  amount: number;
  reference: string;
  fee_address?: string;
  fee_amount?: number;
}

interface TransactionResult {
  meta?: {
    err: unknown;
    preBalances: number[];
    postBalances: number[];
  };
  transaction?: {
    message?: {
      accountKeys?: string[];
      staticAccountKeys?: string[];
    };
  };
}

/** Call a Solana JSON-RPC method via fetch. */
async function solanaRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(solanaRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

/** Extract account keys from a transaction, supporting both legacy and v0 formats. */
function getAccountKeys(tx: TransactionResult): string[] {
  const msg = tx.transaction?.message;
  if (!msg) return [];
  // Legacy transactions use accountKeys, versioned (v0) use staticAccountKeys
  return msg.accountKeys ?? msg.staticAccountKeys ?? [];
}

/**
 * Verify that a transaction transferred the correct amounts to recipient and treasury.
 * Shared by both reference-based and signature-based verification paths.
 */
function verifyTransactionBalances(
  tx: TransactionResult,
  recipient: string,
  expectedNet: number,
  feeAmount: number,
): boolean {
  if (!tx.meta || tx.meta.err) return false;

  const { preBalances, postBalances } = tx.meta;
  const accountKeys = getAccountKeys(tx);

  const recipientIdx = accountKeys.indexOf(recipient);
  if (recipientIdx === -1) return false;

  const received = postBalances[recipientIdx]! - preBalances[recipientIdx]!;
  if (received < expectedNet) return false;

  if (feeAmount > 0) {
    const feeIdx = accountKeys.indexOf(PROTOCOL_TREASURY);
    if (feeIdx === -1) return false;
    const feeReceived = postBalances[feeIdx]! - preBalances[feeIdx]!;
    if (feeReceived < feeAmount) return false;
  }

  return true;
}

/**
 * Verify a Solana payment on-chain using the reference key from the payment request.
 *
 * Mirrors the Rust SDK's `lookup_payment()`:
 * 1. Query `getSignaturesForAddress(reference)` to find transactions
 * 2. For each signature, fetch the transaction and check pre/post balances
 * 3. Verify provider received >= (amount - fee) and treasury received >= fee
 */
async function verifySolanaPayment(paymentRequestJson: string): Promise<{ verified: boolean; txSignature?: string }> {
  if (!solanaRpcUrl) return { verified: false };

  let data: PaymentRequestData;
  try {
    data = JSON.parse(paymentRequestJson);
  } catch {
    return { verified: false };
  }

  if (!data.reference || !data.recipient || data.amount <= 0) {
    return { verified: false };
  }

  const feeAmount = data.fee_amount ?? 0;
  const expectedNet = data.amount - feeAmount;

  // Validate fee address matches protocol treasury
  if (feeAmount > 0 && data.fee_address && data.fee_address !== PROTOCOL_TREASURY) {
    log(`Payment request has invalid fee_address: ${data.fee_address}`);
    return { verified: false };
  }

  try {
    // 1. Find transactions referencing the payment's unique reference key
    const sigResult = await solanaRpc("getSignaturesForAddress", [
      data.reference,
      { limit: 10 },
    ]) as Array<{ signature: string; err: unknown }>;

    if (!sigResult || sigResult.length === 0) return { verified: false };

    // 2. Fetch all valid transactions in parallel
    const validSigs = sigResult.filter((s) => !s.err);
    if (validSigs.length === 0) return { verified: false };

    const txResults = await Promise.all(
      validSigs.map((s) =>
        solanaRpc("getTransaction", [
          s.signature,
          { encoding: "json", maxSupportedTransactionVersion: 0 },
        ]) as Promise<TransactionResult | null>,
      ),
    );

    // 3. Check each transaction for correct transfers
    for (let i = 0; i < txResults.length; i++) {
      const tx = txResults[i];
      if (!tx) continue;
      if (verifyTransactionBalances(tx, data.recipient, expectedNet, feeAmount)) {
        return { verified: true, txSignature: validSigs[i]!.signature };
      }
    }

    return { verified: false };
  } catch (e) {
    log(`Payment verification RPC error: ${e}`);
    return { verified: false };
  }
}

/**
 * Poll for on-chain payment confirmation with retries.
 * Customer's transaction may take a few seconds to confirm.
 */
async function waitForPaymentVerification(
  paymentRequestJson: string,
  maxAttempts = 15,
  intervalMs = 2000,
): Promise<{ verified: boolean; txSignature?: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await verifySolanaPayment(paymentRequestJson);
      if (result.verified) return result;
    } catch (e) {
      log(`Payment verification attempt ${i + 1} error: ${e}`);
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return { verified: false };
}

/**
 * Verify a Solana transaction by its signature.
 * Used during recovery when we don't have the original payment request
 * but have the tx signature from the payment-completed feedback event.
 */
async function verifySolanaTransactionBySignature(
  txSignature: string,
  recipientAddress: string,
  expectedAmount: number,
): Promise<boolean> {
  if (!solanaRpcUrl || !txSignature) return false;

  try {
    const feeAmount = PaymentService.calculateProtocolFee(expectedAmount);
    const expectedNet = expectedAmount - feeAmount;

    const tx = await solanaRpc("getTransaction", [
      txSignature,
      { encoding: "json", maxSupportedTransactionVersion: 0 },
    ]) as TransactionResult | null;

    if (!tx) return false;
    return verifyTransactionBalances(tx, recipientAddress, expectedNet, feeAmount);
  } catch (e) {
    log(`TX verification error for ${txSignature.slice(0, 12)}...: ${e}`);
    return false;
  }
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

        // Guard against duplicate payment-completed events from multiple relays
        if (verifyingJobs.has(event.id)) return;

        // Limit verification attempts to prevent abuse from fake events
        const attempts = verificationAttempts.get(event.id) ?? 0;
        if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
          log(`Max verification attempts (${MAX_VERIFICATION_ATTEMPTS}) reached for ${event.id.slice(0, 8)} — ignoring`);
          return;
        }
        verificationAttempts.set(event.id, attempts + 1);
        verifyingJobs.add(event.id);

        try {
          // Verify the payment on-chain before delivering the result.
          // Uses the reference key from the payment request to find the
          // transaction and checks that the correct amounts were transferred.
          log(`Verifying on-chain payment for ${event.id.slice(0, 8)} (attempt ${attempts + 1}/${MAX_VERIFICATION_ATTEMPTS})...`);
          const verification = await waitForPaymentVerification(paymentRequestJson);
          if (!verification.verified) {
            log(`Payment verification FAILED for ${event.id.slice(0, 8)} — ${attempts + 1 < MAX_VERIFICATION_ATTEMPTS ? "will retry on next event" : "max attempts reached"}`);
            processedJobs.delete(event.id);
            return;
          }
          log(`Payment verified on-chain (tx: ${verification.txSignature?.slice(0, 12)}...) for ${event.id.slice(0, 8)}`);

          await deliverResult(event, matchedCap.dTag, matchedCap.card.name, price);
          paymentSub.close();
        } finally {
          verifyingJobs.delete(event.id);
        }
      },
    );
    paymentSubs.push(paymentSub);
  } else {
    await deliverResult(event, matchedCap.dTag, matchedCap.card.name, 0);
  }
}

async function setupSubscriptions() {
  if (!client || !identity) return;

  const pk = identity.publicKey;

  // Ping/pong responder — wait for relay EOSE before considering active
  dmSub = await client.pool.subscribeAndWait(
    { kinds: [KIND_PING], "#p": [pk] } as Filter,
    (ev: Event) => {
      try {
        const msg = JSON.parse(ev.content);
        if (msg.type !== "elisym_ping" || !msg.nonce) return;
        const senderPubkey = ev.pubkey;
        const nonce: string = msg.nonce;

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
          .catch((err: unknown) => log(`✗ Pong failed to ${senderPubkey.slice(0, 8)}: ${err}`));
      } catch {
        /* ignore malformed */
      }
    },
  );
  log("Ping responder active (EOSE confirmed)");

  // Job handler — wait for relay EOSE before considering active
  jobSub = await client.pool.subscribeAndWait(
    {
      kinds: [KIND_JOB_REQUEST],
      "#p": [pk],
      since: Math.floor(Date.now() / 1000),
    } as Filter,
    (event: Event) => void handleJob(event),
  );
  log("Job handler active (EOSE confirmed)");
}

// --------------- Reconnect ---------------

async function restartConnectionAsync() {
  if (isReconnecting || !client) return;
  isReconnecting = true;

  closeSubs();
  client.pool.reset();
  await setupSubscriptions();
  isReconnecting = false;
  log("Reconnected (pool reset, subs confirmed)");
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
  verifyingJobs.clear();
  verificationAttempts.clear();
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

  solanaRpcUrl = msg.rpcUrl;
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
      // Ensure subscriptions are alive before announcing ourselves as online.
      // After OS suspend / Power Nap, WebSocket connections die but timers
      // still fire — publishing a heartbeat without live subs makes us appear
      // online while being unable to respond to pings or jobs.
      if (!dmSub || !jobSub) {
        log("Subs dead before heartbeat — reconnecting first");
        await restartConnectionAsync();
      }
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
        await restartConnectionAsync();
        consecutiveErrors = 0;
      }
    }
  };

  // --- Subscriptions first, then heartbeat ---
  // Ensure we can respond to pings/jobs before announcing ourselves as online.
  setupSubscriptions().then(() => {
    void publishHeartbeat();
    heartbeatInterval = setInterval(() => void publishHeartbeat(), HEARTBEAT_MS);
    log("Heartbeat started");
  });

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
      void restartConnectionAsync().then(() => publishHeartbeat());
    }
  }, SUSPEND_CHECK_MS);

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
      kinds: [KIND_JOB_REQUEST],
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
    const paidJobTxSigs = new Map<string, string>(); // job ID → tx signature
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
        const txTag = fb.tags.find((t) => t[0] === "tx");
        if (txTag?.[1]) paidJobTxSigs.set(eTag, txTag[1]);
      }
    }

    // 4. Fetch results already delivered by us
    const results = await client.pool.queryBatchedByTag(
      { kinds: [KIND_JOB_RESULT], authors: [myPubkey] } as Filter,
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
        // Paid but not delivered → verify on-chain first, then deliver
        try {
          const walletAddr = matchedCap.card.payment?.address;
          const txSig = paidJobTxSigs.get(req.id);
          if (price > 0 && walletAddr) {
            if (txSig) {
              const verified = await verifySolanaTransactionBySignature(txSig, walletAddr, price);
              if (!verified) {
                log(`Recovery: payment verification FAILED for ${req.id.slice(0, 8)} — skipped`);
                continue;
              }
            } else {
              log(`Recovery: no tx signature for paid job ${req.id.slice(0, 8)} — skipped`);
              continue;
            }
          }
          await deliverResult(req, matchedCap.dTag, matchedCap.card.name, price);
          processedJobs.add(req.id);
          log(`Recovered paid job ${req.id.slice(0, 8)}...`);
          recovered++;
        } catch (e) {
          post({ type: "log", level: "error", message: `Recovery failed for ${req.id.slice(0, 8)}...: ${e}` });
        }
      } else if (price === 0 && !ourFeedbackJobIds.has(req.id)) {
        // Free job, no feedback from us, no result → deliver now
        try {
          await deliverResult(req, matchedCap.dTag, matchedCap.card.name, 0);
          processedJobs.add(req.id);
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
            void restartConnectionAsync();
          });
      }
      break;
  }
};
