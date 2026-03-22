import { useElisymClient } from "./useElisymClient";
import { useLocalQuery } from "./useLocalQuery";
import { useOptionalIdentity } from "./useIdentity";
import { getDeletedDTags } from "./useHeartbeat";
import { toDTag, type Agent } from "@elisym/sdk";

export function useAgents() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const myPubkey = idCtx?.publicKey ?? "";

  return useLocalQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const agents = await client.discovery.fetchAgents("devnet", 1000);

      // Filter out locally-deleted capabilities from own agent
      if (myPubkey) {
        const deletedDTags = getDeletedDTags();
        if (deletedDTags.size > 0) {
          const myAgent = agents.find((a) => a.pubkey === myPubkey);
          if (myAgent) {
            myAgent.cards = myAgent.cards.filter(
              (c) => !deletedDTags.has(toDTag(c.name)),
            );
            // Remove agent entirely if no cards left
            if (myAgent.cards.length === 0) {
              return agents.filter((a) => a.pubkey !== myPubkey);
            }
          }
        }
      }

      return agents;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}
