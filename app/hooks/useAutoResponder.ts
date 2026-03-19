import { useState, useCallback, useRef, useEffect } from "react";
import { useElisymClient } from "@elisym/sdk/react";
import { ElisymIdentity } from "@elisym/sdk";
import type { Event } from "nostr-tools";

type SubCloser = { close: (reason?: string) => void };

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: "job" | "dm";
  senderPubkey: string;
  preview: string;
  response: string;
}

export interface ProviderCard {
  name: string;
  description: string;
  price: string;
  capabilities: string[];
}

const STORAGE_KEY = "elisym:provider-cards";
const PING_COOLDOWN_MS = 1000;

export function loadProviderCards(): ProviderCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProviderCard[]) : [];
  } catch {
    return [];
  }
}

export function useAutoResponder() {
  const { client } = useElisymClient();
  const [online, setOnline] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const subsRef = useRef<SubCloser[]>([]);
  const onlineRef = useRef(false);
  const lastPingRef = useRef<Map<string, number>>(new Map());

  // Keep ref in sync so callbacks see current value
  onlineRef.current = online;

  const addActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const goOnline = useCallback(async () => {
    if (onlineRef.current) return;

    const identity =
      ElisymIdentity.fromLocalStorage("elisym:identity") ??
      ElisymIdentity.generate();
    identity.persist("elisym:identity");

    const cards = loadProviderCards();
    if (cards.length === 0) return;

    // Publish capabilities
    for (const card of cards) {
      await client.discovery.publishCapability(identity, {
        name: card.name,
        description: card.description,
        capabilities: card.capabilities,
      });
    }

    // Subscribe to job requests (kind:5100)
    const jobSub = client.marketplace.subscribeToJobRequests(
      identity,
      [5100],
      (event: Event) => {
        const inputTag = event.tags.find((t) => t[0] === "i");
        const preview = (inputTag?.[1] ?? event.content ?? "").slice(0, 80);

        client.marketplace
          .submitJobResult(identity, event, "hello")
          .catch(console.error);

        addActivity({
          id: event.id,
          timestamp: Math.floor(Date.now() / 1000),
          type: "job",
          senderPubkey: event.pubkey,
          preview,
          response: "hello",
        });
      },
    );
    subsRef.current.push(jobSub);

    // Subscribe to DMs (NIP-17)
    const dmSub = client.messaging.subscribeToMessages(
      identity,
      (senderPubkey: string, content: string) => {
        // Handle ping → pong
        try {
          const msg = JSON.parse(content);
          if (msg.type === "elisym_ping" && msg.nonce) {
            const now = Date.now();
            const lastPing = lastPingRef.current.get(senderPubkey) ?? 0;
            if (now - lastPing < PING_COOLDOWN_MS) return;
            lastPingRef.current.set(senderPubkey, now);

            const pong = JSON.stringify({
              type: "elisym_pong",
              nonce: msg.nonce,
            });
            client.messaging
              .sendMessage(identity, senderPubkey, pong)
              .catch(console.error);

            addActivity({
              id: crypto.randomUUID(),
              timestamp: Math.floor(Date.now() / 1000),
              type: "dm",
              senderPubkey,
              preview: "ping",
              response: "pong",
            });
            return;
          }
        } catch {
          // not JSON, treat as regular message
        }

        // Auto-reply "hello" to regular messages
        client.messaging
          .sendMessage(identity, senderPubkey, "hello")
          .catch(console.error);

        addActivity({
          id: crypto.randomUUID(),
          timestamp: Math.floor(Date.now() / 1000),
          type: "dm",
          senderPubkey,
          preview: content.slice(0, 80),
          response: "hello",
        });
      },
    );
    subsRef.current.push(dmSub);

    setOnline(true);
  }, [client, addActivity]);

  const goOffline = useCallback(() => {
    for (const sub of subsRef.current) {
      sub.close();
    }
    subsRef.current = [];
    setOnline(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const sub of subsRef.current) {
        sub.close();
      }
      subsRef.current = [];
    };
  }, []);

  return { online, activity, goOnline, goOffline };
}
