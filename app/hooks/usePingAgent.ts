import { useState, useEffect } from "react";
import { useElisymClient } from "./useElisymClient";

export type PingStatus = "pinging" | "online" | "offline";

/**
 * Pings an agent on mount with automatic retry.
 * - Starts as "pinging" (yellow)
 * - Probes pool health before first ping, resets if dead
 * - Up to 3 attempts with 1.5s between retries
 * - If pong arrives (even after timeout) → "online" (green)
 */
export function usePingAgent(agentPubkey: string) {
  const { client, resetPool } = useElisymClient();
  const [status, setStatus] = useState<PingStatus>("pinging");

  useEffect(() => {
    if (!agentPubkey) return;
    setStatus("pinging");

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const ping = (attempt: number) => {
      console.log(`[usePingAgent] attempt ${attempt} for ${agentPubkey.slice(0, 8)}`);
      client.messaging
        .pingAgent(agentPubkey, 5_000)
        .then(({ online }) => {
          if (cancelled) return;
          console.log(`[usePingAgent] attempt ${attempt} result: ${online ? "online" : "offline"}`);
          if (online) {
            setStatus("online");
          } else if (attempt < 3) {
            retryTimer = setTimeout(() => {
              if (!cancelled) ping(attempt + 1);
            }, 1500);
          } else {
            setStatus("offline");
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error(`[usePingAgent] attempt ${attempt} error:`, err);
          if (attempt < 3) {
            retryTimer = setTimeout(() => {
              if (!cancelled) ping(attempt + 1);
            }, 1500);
          } else {
            setStatus("offline");
          }
        });
    };

    // Probe pool health before first ping, reset if dead
    client.pool.probe(3_000).then((ok) => {
      if (cancelled) return;
      if (!ok) {
        console.log("[usePingAgent] pool probe failed, resetting");
        resetPool();
      }
      ping(1);
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [agentPubkey, client]);

  return status;
}
