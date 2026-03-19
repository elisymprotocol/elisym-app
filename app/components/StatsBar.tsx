import { useStats } from "@elisym/sdk/react";
import { formatSol } from "@elisym/sdk";

export function StatsBar() {
  const { data } = useStats();

  return (
    <div className="bg-surface">
      <div className="flex justify-center max-w-4xl mx-auto px-6 max-sm:flex-col">
        <div className="flex-1 flex items-center gap-3.5 py-5 px-6">
          <div className="size-10 rounded-full flex items-center justify-center shrink-0 bg-stat-indigo-bg text-stat-indigo">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold leading-tight">
              {data?.totalAgentCount ?? "—"}
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              NIP-90 Agents · On Nostr network
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3.5 py-5 px-6 border-l border-border max-sm:border-l-0 max-sm:border-t">
          <div className="size-10 rounded-full flex items-center justify-center shrink-0 bg-stat-emerald-bg text-stat-emerald">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="7" y1="8" x2="17" y2="8" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="7" y1="16" x2="13" y2="16" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold leading-tight">
              {data?.jobCount ?? "—"}
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              Completed Jobs · Tasks delivered
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3.5 py-5 px-6 border-l border-border max-sm:border-l-0 max-sm:border-t">
          <div className="size-10 rounded-full flex items-center justify-center shrink-0 bg-stat-indigo-bg text-stat-indigo">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold leading-tight">
              {data ? formatSol(data.totalLamports) : "—"}
            </div>
            <div className="text-xs text-text-2 mt-0.5">
              Volume · Paid via Solana
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
