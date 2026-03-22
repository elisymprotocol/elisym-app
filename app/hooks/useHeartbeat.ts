import { useEffect, useRef } from "react";
import { useOptionalIdentity } from "./useIdentity";
import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatSol, type CapabilityCard } from "@elisym/sdk";
import { toast } from "sonner";
import type { Filter } from "nostr-tools";

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
  const idCtx = useOptionalIdentity();
  const identity = idCtx?.identity ?? null;
  const pubkey = idCtx?.publicKey ?? "";
  const { publicKey } = useWallet();
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
      const byDTag = new Map<string, { card: CapabilityCard; dTag: string; ts: number }>();
      for (const ev of events) {
        try {
          const parsed = JSON.parse(ev.content) as CapabilityCard & { deleted?: boolean };
          if (!parsed.name || parsed.deleted) continue;
          const dTag = ev.tags.find((t: string[]) => t[0] === "d")?.[1] ?? "";
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
  });

  const workerRef = useRef<Worker | null>(null);

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
        const { capabilityName, amount } = e.data;
        const solStr = amount > 0 ? ` for ${formatSol(amount)}` : "";
        toast.success(`Sale: "${capabilityName}"${solStr} delivered`);
      }
    };

    worker.postMessage({
      type: "start",
      secretKeyHex,
      capabilities,
    });

    workerRef.current = worker;

    return () => {
      worker.postMessage({ type: "stop" });
      worker.terminate();
      workerRef.current = null;
    };
  }, [identity, capabilities, walletAddress]);
}
