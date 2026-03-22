import { useState, useEffect } from "react";
import { useElisymClient } from "./useElisymClient";

export type PingStatus = "pinging" | "online" | "offline";

/**
 * Pings an agent on mount with automatic retry.
 * - Starts as "pinging" (yellow)
 * - If first ping fails, retries after 1.5s (pool connections may not be ready yet)
 * - After 8s total timeout → "offline" (red)
 * - If pong arrives (even after timeout) → "online" (green)
 */
export function usePingAgent(agentPubkey: string) {
  const { client } = useElisymClient();
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
          } else if (attempt < 2) {
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
          if (attempt < 2) {
            retryTimer = setTimeout(() => {
              if (!cancelled) ping(attempt + 1);
            }, 1500);
          } else {
            setStatus("offline");
          }
        });
    };

    ping(1);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [agentPubkey, client]);

  return status;
}
