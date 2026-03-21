import { useEffect, useRef } from "react";
import { useElisymClient } from "./useElisymClient";
import { useOptionalIdentity } from "./useIdentity";
import { useLocalQuery } from "./useLocalQuery";
import type { CapabilityCard } from "@elisym/sdk";
import type { Filter } from "nostr-tools";

type SubCloser = { close: (reason?: string) => void };

const HEARTBEAT_MS = 60_000;
const PING_COOLDOWN_MS = 1000;

/**
 * Automatically republishes the most recent capability every 60s
 * to keep the agent fresh in marketplace listings.
 * Reacts to identity changes — stops old heartbeat, starts new one.
 */
export function useHeartbeat() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const identity = idCtx?.identity ?? null;
  const pubkey = idCtx?.publicKey ?? "";

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dmSubRef = useRef<SubCloser | null>(null);
  const lastPingRef = useRef<Map<string, number>>(new Map());

  // Heartbeat: republish last capability every 60s
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!identity || !capabilities || capabilities.length === 0) return;

    const lastCap = capabilities[capabilities.length - 1]!;

    // Publish immediately, then every 60s
    client.discovery
      .publishCapability(identity, lastCap.card)
      .catch(console.error);

    intervalRef.current = setInterval(() => {
      client.discovery
        .publishCapability(identity, lastCap.card)
        .catch(console.error);
    }, HEARTBEAT_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [identity, capabilities, client]);

  // Ping/pong responder: reply to elisym_ping DMs
  useEffect(() => {
    if (dmSubRef.current) {
      dmSubRef.current.close();
      dmSubRef.current = null;
    }
    lastPingRef.current.clear();

    if (!identity) return;

    dmSubRef.current = client.messaging.subscribeToMessages(
      identity,
      (senderPubkey: string, content: string) => {
        try {
          const msg = JSON.parse(content);
          if (msg.type === "elisym_ping" && msg.nonce) {
            const now = Date.now();
            const lastPing = lastPingRef.current.get(senderPubkey) ?? 0;
            if (now - lastPing < PING_COOLDOWN_MS) return;
            lastPingRef.current.set(senderPubkey, now);

            client.messaging
              .sendMessage(
                identity,
                senderPubkey,
                JSON.stringify({ type: "elisym_pong", nonce: msg.nonce }),
              )
              .catch(console.error);
          }
        } catch {
          // not JSON — ignore
        }
      },
    );

    return () => {
      if (dmSubRef.current) {
        dmSubRef.current.close();
        dmSubRef.current = null;
      }
    };
  }, [identity, client]);
}
