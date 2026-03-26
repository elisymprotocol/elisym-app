import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import { KIND_JOB_FEEDBACK, KIND_JOB_REQUEST } from "@elisym/sdk";
import type { FeedbackCounts } from "./useAgentFeedback";

export interface CapabilityStats extends FeedbackCounts {
  purchases: number;
}

/** capability name → CapabilityStats */
export type CapabilityStatsMap = Record<string, CapabilityStats>;

export interface CapabilityFeedbackResult {
  byCapability: CapabilityStatsMap;
  totalPurchases: number;
}

export function useCapabilityFeedback(providerPubkey: string) {
  const { client } = useElisymClient();

  return useLocalQuery<CapabilityFeedbackResult>({
    queryKey: ["capability-feedback", providerPubkey],
    queryFn: async () => {
      const empty: CapabilityFeedbackResult = { byCapability: {}, totalPurchases: 0 };
      if (!providerPubkey) return empty;

      // Fetch all job requests targeted at this provider
      const jobRequests = await client.pool.querySync({
        kinds: [KIND_JOB_REQUEST],
        "#p": [providerPubkey],
      });

      // Map job ID → capability name, count purchases per capability
      const jobCapability = new Map<string, string>();
      const map: CapabilityStatsMap = {};

      for (const req of jobRequests) {
        const capability = req.tags.find(
          (t) => t[0] === "t" && t[1] !== "elisym",
        )?.[1];
        if (!capability) continue;

        jobCapability.set(req.id, capability);
        if (!map[capability]) {
          map[capability] = { positive: 0, negative: 0, total: 0, purchases: 0 };
        }
        map[capability].purchases++;
      }

      // Fetch rating feedback events
      const feedbackEvents = await client.pool.querySync({
        kinds: [KIND_JOB_FEEDBACK],
        "#p": [providerPubkey],
      });

      for (const ev of feedbackEvents) {
        const ratingTag = ev.tags.find((t) => t[0] === "rating");
        if (!ratingTag) continue;

        const jobId = ev.tags.find((t) => t[0] === "e")?.[1];
        if (!jobId) continue;

        const capability = jobCapability.get(jobId);
        if (!capability) continue;

        if (!map[capability]) {
          map[capability] = { positive: 0, negative: 0, total: 0, purchases: 0 };
        }

        if (ratingTag[1] === "1") {
          map[capability].positive++;
        } else {
          map[capability].negative++;
        }
        map[capability].total++;
      }

      const totalPurchases = jobRequests.length;
      return { byCapability: map, totalPurchases };
    },
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 120,
    enabled: !!providerPubkey,
  });
}
