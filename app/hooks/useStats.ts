import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import type { NetworkStats } from "@elisym/sdk";

export function useStats() {
  const { client } = useElisymClient();

  return useLocalQuery<NetworkStats>({
    queryKey: ["network-stats"],
    queryFn: async () => {
      const totalAgentCount = await client.discovery.fetchAllAgentCount();

      const jobs = await client.marketplace.fetchRecentJobs(
        undefined,
        undefined,
        Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60,
      );

      const completedJobs = jobs.filter((j) => j.status === "success");
      let totalLamports = 0;
      for (const j of completedJobs) {
        if (j.amount) totalLamports += j.amount;
      }

      return {
        totalAgentCount,
        agentCount: totalAgentCount,
        jobCount: completedJobs.length,
        totalLamports,
      };
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
