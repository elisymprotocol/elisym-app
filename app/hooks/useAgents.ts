import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import type { Agent } from "@elisym/sdk";

export function useAgents() {
  const { client } = useElisymClient();

  return useLocalQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => client.discovery.fetchAgents("devnet", 1000),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
