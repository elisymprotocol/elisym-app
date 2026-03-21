import { useState, useCallback, useRef, useEffect } from "react";
import { useElisymClient } from "./useElisymClient";
import { ElisymIdentity } from "@elisym/sdk";
import { toast } from "sonner";
import { useOptionalIdentity } from "./useIdentity";

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
  image?: string;
  walletAddress?: string;
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
  const idCtx = useOptionalIdentity();
  const [online, setOnline] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const subsRef = useRef<SubCloser[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      idCtx?.identity ??
      ElisymIdentity.fromLocalStorage("elisym:identity") ??
      ElisymIdentity.generate();

    const cards = loadProviderCards();
    if (cards.length === 0) return;

    // Publish capabilities (best-effort — DM subscription below is what matters for ping)
    const publishableCards = cards.filter((card) => card.walletAddress);
    for (const card of publishableCards) {
      try {
        const price = card.price
          ? Math.round(parseFloat(card.price.replace(",", ".")) * 1_000_000_000)
          : undefined;
        await client.discovery.publishCapability(identity, {
          name: card.name,
          description: card.description,
          capabilities: card.capabilities,
          image: card.image,
          payment: {
            chain: "solana",
            network: "devnet",
            address: card.walletAddress!,
            ...(price != null ? { job_price: price } : {}),
          },
        });
      } catch (err) {
        console.error("Failed to publish capability:", card.name, err);
      }
    }

    // Heartbeat: republish last publishable capability every 60s to stay fresh in listings
    const lastCard = publishableCards[publishableCards.length - 1];
    if (lastCard) {
      heartbeatRef.current = setInterval(() => {
        const price = lastCard.price
          ? Math.round(parseFloat(lastCard.price.replace(",", ".")) * 1_000_000_000)
          : undefined;
        client.discovery
          .publishCapability(identity, {
            name: lastCard.name,
            description: lastCard.description,
            capabilities: lastCard.capabilities,
            image: lastCard.image,
            payment: {
              chain: "solana",
              network: "devnet",
              address: lastCard.walletAddress!,
              ...(price != null ? { job_price: price } : {}),
            },
          })
          .catch(console.error);
      }, 60_000);
    }

    // Subscribe to pings (plain ephemeral events, no encryption)
    const pingSub = client.messaging.subscribeToPings(
      identity,
      (senderPubkey: string, nonce: string) => {
        const now = Date.now();
        const lastPing = lastPingRef.current.get(senderPubkey) ?? 0;
        if (now - lastPing < PING_COOLDOWN_MS) return;
        lastPingRef.current.set(senderPubkey, now);

        client.messaging
          .sendPong(identity, senderPubkey, nonce)
          .catch(console.error);

        addActivity({
          id: crypto.randomUUID(),
          timestamp: Math.floor(Date.now() / 1000),
          type: "dm",
          senderPubkey,
          preview: "ping",
          response: "pong",
        });
      },
    );
    subsRef.current.push(pingSub);

    setOnline(true);
    toast.success("Provider mode active");
  }, [client, addActivity, idCtx?.identity]);

  const goOffline = useCallback(() => {
    for (const sub of subsRef.current) {
      sub.close();
    }
    subsRef.current = [];
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    setOnline(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const sub of subsRef.current) {
        sub.close();
      }
      subsRef.current = [];
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, []);

  return { online, activity, goOnline, goOffline };
}
