import { useState } from "react";
import Decimal from "decimal.js-light";
import { useOptionalIdentity } from "~/hooks/useIdentity";
import { useElisymClient } from "~/hooks/useElisymClient";
import { useLocalQuery } from "~/hooks/useLocalQuery";
import type { Filter } from "nostr-tools";

export function ProfileStats() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const pubkey = idCtx?.publicKey ?? "";
  const [syncing, setSyncing] = useState(false);

  const { data: earned, refetch } = useLocalQuery<number>({
    queryKey: ["earned-lamports", pubkey],
    queryFn: async () => {
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
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  const earnedSol = new Decimal(earned ?? 0).div(1e9).toFixed(2);

  async function handleResync() {
    setSyncing(true);
    try {
      await refetch();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="text-center py-5 bg-surface-2 rounded-xl">
      <div className="text-2xl font-bold mb-1">{earnedSol} SOL</div>
      <div className="text-[12.5px] text-text-2 mb-3">Earned</div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-[11px] text-text-2">Updates every 60s</span>
        <button
          onClick={handleResync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 py-1 px-3 rounded-lg border border-border bg-surface text-[11px] font-medium text-text-2 cursor-pointer hover:border-accent hover:text-text disabled:opacity-50 transition-colors"
        >
          {syncing ? (
            <>
              <svg className="size-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6" />
                <path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
              Resync
            </>
          )}
        </button>
      </div>
    </div>
  );
}
