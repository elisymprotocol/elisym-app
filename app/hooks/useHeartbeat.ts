import { useEffect, useRef } from "react";
import { useElisymClient } from "./useElisymClient";
import { useOptionalIdentity } from "./useIdentity";
import { useLocalQuery } from "./useLocalQuery";
import { cacheGet } from "~/lib/localCache";
import { PaymentService, toDTag, type CapabilityCard } from "@elisym/sdk";
import type { Filter, Event } from "nostr-tools";

type SubCloser = { close: (reason?: string) => void };

const HEARTBEAT_MS = 60_000;
const PING_COOLDOWN_MS = 1000;

/**
 * Heartbeat + ping/pong + job handler.
 * - Republishes last capability every 60s to stay fresh
 * - Responds to ping DMs with pong
 * - Listens for job requests, requests payment, delivers static result
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
  const jobSubRef = useRef<SubCloser | null>(null);
  const paymentSubsRef = useRef<SubCloser[]>([]);
  const lastPingRef = useRef<Map<string, number>>(new Map());
  const processedJobsRef = useRef<Set<string>>(new Set());

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

  // Ping/pong responder
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

  // Job request handler: listen for kind:5100, request payment, deliver result
  useEffect(() => {
    if (jobSubRef.current) {
      jobSubRef.current.close();
      jobSubRef.current = null;
    }
    for (const sub of paymentSubsRef.current) sub.close();
    paymentSubsRef.current = [];
    processedJobsRef.current.clear();

    if (!identity || !capabilities || capabilities.length === 0) return;

    // Build capability lookup: tag → { card, dTag }
    const capByTag = new Map<string, { card: CapabilityCard; dTag: string }>();
    for (const cap of capabilities) {
      for (const tag of cap.card.capabilities) {
        capByTag.set(tag, cap);
      }
      // Also match by d-tag (capability name slug)
      capByTag.set(cap.dTag, cap);
    }

    const handleJobRequest = async (event: Event) => {
      // Dedup
      if (processedJobsRef.current.has(event.id)) return;
      processedJobsRef.current.add(event.id);

      // Find matching capability
      const requestedTag = event.tags.find((t) => t[0] === "t" && t[1] !== "elisym")?.[1];
      const matchedCap = requestedTag ? capByTag.get(requestedTag) : capabilities[0];
      if (!matchedCap) return;

      const price = matchedCap.card.payment?.job_price ?? 0;
      const walletAddress = matchedCap.card.payment?.address;

      if (price > 0 && walletAddress) {
        // Request payment
        const paymentRequest = PaymentService.createPaymentRequest(walletAddress, price);
        const paymentRequestJson = JSON.stringify(paymentRequest);

        await client.marketplace.submitPaymentRequiredFeedback(
          identity,
          event,
          price,
          paymentRequestJson,
        );

        // Listen for payment confirmation
        const paymentSub = client.pool.subscribe(
          {
            kinds: [7000],
            "#e": [event.id],
            since: Math.floor(Date.now() / 1000) - 5,
          } as Filter,
          async (feedbackEv) => {
            const statusTag = feedbackEv.tags.find((t) => t[0] === "status");
            if (statusTag?.[1] !== "payment-completed") return;

            // Payment received — deliver result
            await deliverResult(event, matchedCap.dTag, price);
            paymentSub.close();
          },
        );
        paymentSubsRef.current.push(paymentSub);
      } else {
        // Free capability — deliver immediately
        await deliverResult(event, matchedCap.dTag, 0);
      }
    };

    const deliverResult = async (requestEvent: Event, dTag: string, amount: number) => {
      const result = await cacheGet<string>(`capability-result:${dTag}`);
      const content = result || "No delivery content configured.";

      await client.marketplace.submitJobResult(
        identity!,
        requestEvent,
        content,
        amount > 0 ? amount : undefined,
      );
    };

    jobSubRef.current = client.marketplace.subscribeToJobRequests(
      identity,
      [5100],
      (event) => void handleJobRequest(event),
    );

    return () => {
      if (jobSubRef.current) {
        jobSubRef.current.close();
        jobSubRef.current = null;
      }
      for (const sub of paymentSubsRef.current) sub.close();
      paymentSubsRef.current = [];
    };
  }, [identity, capabilities, client]);
}
