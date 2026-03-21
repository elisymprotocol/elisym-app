import { useState } from "react";
import Decimal from "decimal.js-light";
import { truncateKey, timeAgo } from "@elisym/sdk";
import { useElisymClient } from "~/hooks/useElisymClient";
import { useOptionalIdentity } from "~/hooks/useIdentity";
import { useLocalQuery } from "~/hooks/useLocalQuery";
import type { Filter } from "nostr-tools";

interface Order {
  jobEventId: string;
  capability: string;
  providerPubkey?: string;
  status: "pending" | "completed";
  result?: string;
  amount?: number;
  createdAt: number;
}

export function OrderHistory() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const pubkey = idCtx?.publicKey ?? "";
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: orders, refetch } = useLocalQuery<Order[]>({
    queryKey: ["order-history", pubkey],
    queryFn: async () => {
      // Fetch job requests authored by this pubkey
      const requests = await client.pool.querySync({
        kinds: [5100],
        authors: [pubkey],
        "#t": ["elisym"],
      } as Filter);

      if (requests.length === 0) return [];

      const requestIds = requests.map((r) => r.id);

      // Fetch results for these requests
      const results = await client.pool.queryBatchedByTag(
        { kinds: [6100] } as Filter,
        "e",
        requestIds,
      );

      // Index results by request ID
      const resultByRequest = new Map<string, { content: string; amount?: number }>();
      for (const r of results) {
        const eTag = r.tags.find((t) => t[0] === "e");
        if (!eTag?.[1]) continue;
        const amtTag = r.tags.find((t) => t[0] === "amount");
        resultByRequest.set(eTag[1], {
          content: r.content,
          amount: amtTag?.[1] ? parseInt(amtTag[1], 10) : undefined,
        });
      }

      return requests
        .sort((a, b) => b.created_at - a.created_at)
        .map((req) => {
          const capTag = req.tags.find((t) => t[0] === "t" && t[1] !== "elisym");
          const pTag = req.tags.find((t) => t[0] === "p");
          const res = resultByRequest.get(req.id);

          return {
            jobEventId: req.id,
            capability: capTag?.[1] ?? "unknown",
            providerPubkey: pTag?.[1],
            status: res ? "completed" as const : "pending" as const,
            result: res?.content,
            amount: res?.amount,
            createdAt: req.created_at,
          };
        });
    },
    enabled: !!pubkey,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });

  async function handleResync() {
    setSyncing(true);
    try {
      await refetch();
    } finally {
      setSyncing(false);
    }
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">Order History</h3>
        </div>
        <p className="text-sm text-text-2 text-center py-4">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-8 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold">Order History</h3>
        <div className="flex items-center gap-2">
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

      <div className="flex flex-col gap-2">
        {orders.map((order) => (
          <div
            key={order.jobEventId}
            className="border border-border rounded-xl bg-surface-2 overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(expandedId === order.jobEventId ? null : order.jobEventId)}
              className="w-full flex items-center justify-between p-4 bg-transparent border-none cursor-pointer text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`size-2 rounded-full shrink-0 ${
                  order.status === "completed" ? "bg-emerald-500" : "bg-yellow-400 animate-pulse"
                }`} />
                <span className="text-sm font-medium truncate">{order.capability}</span>
                {order.providerPubkey && (
                  <span className="text-[11px] text-text-2 font-mono shrink-0">
                    {truncateKey(order.providerPubkey, 6)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {order.amount != null && (
                  <span className="text-xs font-semibold text-green">
                    {new Decimal(order.amount).div(1e9).toFixed(2)} SOL
                  </span>
                )}
                <span className="text-[11px] text-text-2">
                  {timeAgo(order.createdAt)}
                </span>
                <svg
                  className={`size-4 text-text-2 transition-transform ${expandedId === order.jobEventId ? "rotate-180" : ""}`}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {expandedId === order.jobEventId && (
              <div className="px-4 pb-4 border-t border-border">
                {order.result ? (
                  <div className="mt-3 p-3 bg-surface rounded-lg border border-border text-xs text-text leading-relaxed whitespace-pre-wrap">
                    {order.result}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-text-2">Waiting for provider response...</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
