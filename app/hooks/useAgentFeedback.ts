import { useRef } from "react";
import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import { KIND_JOB_FEEDBACK, KIND_JOB_REQUEST } from "@elisym/sdk";

export interface FeedbackCounts {
  positive: number;
  negative: number;
  total: number;
  purchases: number;
}

export type FeedbackMap = Record<string, FeedbackCounts>;

/** Merge two maps, keeping the max of each field per pubkey */
function mergeMax(prev: FeedbackMap, next: FeedbackMap): FeedbackMap {
  const merged: FeedbackMap = { ...prev };
  for (const [key, val] of Object.entries(next)) {
    const p = merged[key];
    if (!p) {
      merged[key] = val;
    } else {
      merged[key] = {
        positive: Math.max(p.positive, val.positive),
        negative: Math.max(p.negative, val.negative),
        total: Math.max(p.total, val.total),
        purchases: Math.max(p.purchases, val.purchases),
      };
    }
  }
  return merged;
}

export function useAgentFeedback() {
  const { client } = useElisymClient();
  const highWater = useRef<FeedbackMap>({});

  return useLocalQuery<FeedbackMap>({
    queryKey: ["agent-feedback"],
    queryFn: async () => {
      const [feedbackEvents, jobRequests] = await Promise.all([
        client.pool.querySync({
          kinds: [KIND_JOB_FEEDBACK],
          "#t": ["elisym"],
        }),
        client.pool.querySync({
          kinds: [KIND_JOB_REQUEST],
          "#t": ["elisym"],
        }),
      ]);

      // Dedup events by ID
      const seenFeedback = new Map<string, typeof feedbackEvents[0]>();
      for (const ev of feedbackEvents) seenFeedback.set(ev.id, ev);

      const seenRequests = new Map<string, typeof jobRequests[0]>();
      for (const req of jobRequests) seenRequests.set(req.id, req);

      const map: FeedbackMap = {};

      for (const req of seenRequests.values()) {
        const providerPubkey = req.tags.find((t) => t[0] === "p")?.[1];
        if (!providerPubkey) continue;

        if (!map[providerPubkey]) {
          map[providerPubkey] = { positive: 0, negative: 0, total: 0, purchases: 0 };
        }
        map[providerPubkey].purchases++;
      }

      for (const ev of seenFeedback.values()) {
        const ratingTag = ev.tags.find((t) => t[0] === "rating");
        if (!ratingTag) continue;

        const providerPubkey = ev.tags.find((t) => t[0] === "p")?.[1];
        if (!providerPubkey) continue;

        if (!map[providerPubkey]) {
          map[providerPubkey] = { positive: 0, negative: 0, total: 0, purchases: 0 };
        }

        if (ratingTag[1] === "1") {
          map[providerPubkey].positive++;
        } else {
          map[providerPubkey].negative++;
        }
        map[providerPubkey].total++;
      }

      // Never decrease — merge with high water mark
      highWater.current = mergeMax(highWater.current, map);
      return highWater.current;
    },
    cacheTransform: (cached) => {
      // Seed high water mark from IndexedDB cache on first load
      highWater.current = mergeMax(highWater.current, cached);
      return highWater.current;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
