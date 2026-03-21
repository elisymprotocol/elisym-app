import { useState, useEffect } from "react";
import { useElisymClient } from "./useElisymClient";

export type PingStatus = "pinging" | "online" | "offline";

/**
 * Pings an agent on mount.
 * - Starts as "pinging" (yellow)
 * - After 5s timeout → "offline" (red)
 * - If pong arrives (even after timeout) → "online" (green)
 */
export function usePingAgent(agentPubkey: string) {
  const { client } = useElisymClient();
  const [status, setStatus] = useState<PingStatus>("pinging");

  useEffect(() => {
    if (!agentPubkey) return;
    setStatus("pinging");

    let timeoutFired = false;
    const timer = setTimeout(() => {
      timeoutFired = true;
      setStatus((prev) => (prev === "pinging" ? "offline" : prev));
    }, 5000);

    client.messaging
      .pingAgent(agentPubkey, 30_000) // long SDK timeout — we handle 5s ourselves
      .then(({ online }) => {
        if (online) {
          setStatus("online");
        } else if (!timeoutFired) {
          setStatus("offline");
        }
      })
      .catch(() => {
        if (!timeoutFired) setStatus("offline");
      });

    return () => clearTimeout(timer);
  }, [agentPubkey, client]);

  return status;
}
