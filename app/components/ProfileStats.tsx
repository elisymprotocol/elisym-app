import Decimal from "decimal.js-light";
import { useStats } from "~/hooks/useStats";
import { useOptionalIdentity } from "~/hooks/useIdentity";
import { useElisymClient } from "~/hooks/useElisymClient";
import { useLocalQuery } from "~/hooks/useLocalQuery";
import type { Filter } from "nostr-tools";

export function ProfileStats() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const pubkey = idCtx?.publicKey ?? "";

  const { data: earned } = useLocalQuery<number>({
    queryKey: ["earned-lamports", pubkey],
    queryFn: async () => {
      // Fetch all job results authored by this pubkey (kind:6100)
      const results = await client.pool.querySync({
        kinds: [6100],
        authors: [pubkey],
      } as Filter);

      let total = 0;
      for (const ev of results) {
        const amtTag = ev.tags.find((t) => t[0] === "amount");
        if (amtTag?.[1]) total += parseInt(amtTag[1], 10);
      }
      return total;
    },
    enabled: !!pubkey,
    staleTime: 1000 * 60 * 2,
  });

  const earnedSol = new Decimal(earned ?? 0).div(1e9).toFixed(2);

  return (
    <div className="text-center py-5 bg-surface-2 rounded-xl">
      <div className="text-2xl font-bold mb-1">{earnedSol} SOL</div>
      <div className="text-[12.5px] text-text-2">Earned</div>
    </div>
  );
}
