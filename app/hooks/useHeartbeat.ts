import { useEffect, useRef, useState } from "react";
import { useIdentity } from "./useIdentity";
import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatSol, type CapabilityCard } from "@elisym/sdk";
import { toast } from "sonner";
import type { Filter } from "nostr-tools";

export const CAPABILITIES_CHANGED_EVENT = "elisym:capabilities-changed";

const DELETED_DTAGS_KEY = "elisym:deleted-dtags";

/** Get locally-deleted d-tags (survives page refresh, relay-independent). */
export function getDeletedDTags(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_DTAGS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Mark d-tags as deleted locally. */
export function addDeletedDTags(dTags: Iterable<string>): void {
  const current = getDeletedDTags();
  for (const d of dTags) current.add(d);
  localStorage.setItem(DELETED_DTAGS_KEY, JSON.stringify([...current]));
}

/** Remove d-tags from the deleted list (when re-publishing). */
export function removeDeletedDTags(dTags: Iterable<string>): void {
  const current = getDeletedDTags();
  for (const d of dTags) current.delete(d);
  if (current.size > 0) {
    localStorage.setItem(DELETED_DTAGS_KEY, JSON.stringify([...current]));
  } else {
    localStorage.removeItem(DELETED_DTAGS_KEY);
  }
}

/**
 * Spawns a Web Worker that handles:
 * - Heartbeat (republish last capability every 60s)
 * - Ping/pong responder (NIP-17 DMs)
 * - Job request handler (payment + static result delivery)
 *
 * Reacts to identity changes — restarts the worker with new credentials.
 */
export function useHeartbeat() {
  const { client } = useElisymClient();
  const idCtx = useIdentity();
  const identity = idCtx.identity;
  const pubkey = idCtx.publicKey;
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const walletAddress = publicKey?.toBase58() ?? "";
  const queryClient = useQueryClient();

  // Fetch capabilities for current identity
  const { data: capabilities } = useLocalQuery<{ card: CapabilityCard; dTag: string }[]>({
    queryKey: ["nostr-capabilities", pubkey],
    queryFn: async () => {
      const events = await client.pool.querySync({
        kinds: [31990],
        authors: [pubkey],
        "#t": ["elisym"],
      } as Filter);

      // Local-first: filter out d-tags that were deleted locally
      // (relay tombstones are unreliable when relays are down)
      const deletedDTags = getDeletedDTags();

      const byDTag = new Map<string, { card: CapabilityCard; dTag: string; ts: number }>();
      for (const ev of events) {
        try {
          const parsed = JSON.parse(ev.content) as CapabilityCard & { deleted?: boolean };
          if (!parsed.name || parsed.deleted) continue;
          const dTag = ev.tags.find((t: string[]) => t[0] === "d")?.[1] ?? "";
          if (deletedDTags.has(dTag)) continue;
          const existing = byDTag.get(dTag);
          if (!existing || ev.created_at > existing.ts) {
            byDTag.set(dTag, { card: parsed, dTag, ts: ev.created_at });
          }
        } catch {
          // malformed
        }
      }
      return Array.from(byDTag.values()).map((e) => ({ card: e.card, dTag: e.dTag }));
    },
    enabled: !!pubkey,
    staleTime: 1000 * 60 * 5,
    // Filter deleted d-tags when loading from IndexedDB (before queryFn runs)
    cacheTransform: (data) => {
      const deleted = getDeletedDTags();
      if (deleted.size === 0) return data;
      return data.filter((c) => !deleted.has(c.dTag));
    },
  });

  const workerRef = useRef<Worker | null>(null);

  // Listen for explicit capability changes (e.g. first product created)
  // to ensure the effect re-runs even if React Query's setQueryData
  // notification doesn't trigger a re-render in time.
  const [capsTrigger, setCapsTrigger] = useState(0);
  useEffect(() => {
    const handler = () => setCapsTrigger((v) => v + 1);
    window.addEventListener(CAPABILITIES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(CAPABILITIES_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    // Stop previous worker
    if (workerRef.current) {
      workerRef.current.postMessage({ type: "stop" });
      workerRef.current.terminate();
      workerRef.current = null;
    }

    if (!identity || !capabilities || capabilities.length === 0) return;

    // Republish capabilities if wallet address changed
    if (walletAddress) {
      const needsUpdate = capabilities.some(
        (c) => c.card.payment?.address && c.card.payment.address !== walletAddress,
      );
      if (needsUpdate) {
        const updated = capabilities.map((c) => ({
          ...c,
          card: {
            ...c.card,
            payment: c.card.payment
              ? { ...c.card.payment, address: walletAddress }
              : undefined,
          },
        }));
        // Republish each capability with new wallet address
        for (const cap of updated) {
          client.discovery
            .publishCapability(identity, cap.card)
            .catch(console.error);
        }
        // Update query cache
        queryClient.setQueryData(["nostr-capabilities", pubkey], updated);
        console.log("[heartbeat] Republished capabilities with new wallet address");
      }
    }

    // Get secret key hex from identity
    const secretKeyHex = Array.from(identity.secretKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Spawn worker
    const worker = new Worker(
      new URL("../workers/heartbeat.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e) => {
      if (e.data.type === "log") {
        const fn = e.data.level === "error" ? console.error : console.log;
        fn(`[heartbeat-worker] ${e.data.message}`);
      } else if (e.data.type === "sale") {
        if (publicKey) {
          const { capabilityName, amount } = e.data;
          const solStr = amount > 0 ? ` for ${formatSol(amount)}` : "";
          toast.success(`Sale: "${capabilityName}"${solStr} delivered`);
        }
      }
    };

    worker.onerror = (event) => {
      console.error("[heartbeat-worker] crashed:", event.message);
      worker.terminate();
      workerRef.current = null;
      // Trigger effect re-run to respawn worker
      setCapsTrigger((v) => v + 1);
    };

    worker.postMessage({
      type: "start",
      secretKeyHex,
      capabilities,
      rpcUrl: connection.rpcEndpoint,
    });

    workerRef.current = worker;

    // When tab becomes visible after being backgrounded, tell the worker
    // to reconnect — WebSocket connections may have been closed by the
    // OS or browser while the tab was hidden.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        worker.postMessage({ type: "reconnect" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      // Worker may already be terminated by onerror handler
      if (workerRef.current === worker) {
        worker.postMessage({ type: "stop" });
        worker.terminate();
        workerRef.current = null;
      }
    };
  }, [identity, capabilities, walletAddress, capsTrigger, connection.rpcEndpoint]);
}
