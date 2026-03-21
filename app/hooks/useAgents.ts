import { useQuery } from "@tanstack/react-query";
import { useElisymClient } from "./useElisymClient";
import type { Agent } from "@elisym/sdk";

export function useAgents() {
  const { client } = useElisymClient();

  return useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => client.discovery.fetchAgents("devnet"),
    placeholderData: [],
    staleTime: 1000 * 60 * 2,
  });
}
