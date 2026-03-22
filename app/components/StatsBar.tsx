import { useState } from "react";
import { useStats } from "~/hooks/useStats";
import Decimal from "decimal.js-light";

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-flex ml-1 align-middle">
      <button
        type="button"
        className="text-text-2/40 hover:text-text-2 transition-colors"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onClick={() => setVisible((v) => !v)}
        aria-label="More info"
      >
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </button>
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-[#1a1a2e] px-3 py-2.5 text-xs text-gray-100 leading-relaxed shadow-lg z-50 pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a2e]" />
        </span>
      )}
    </span>
  );
}

const TOOLTIP = "Data is collected from decentralized Nostr relays. Each relay stores a partial view of the network, so the actual numbers may be higher.";

export function StatsBar() {
  const { data } = useStats();

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
        <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="size-11 rounded-xl flex items-center justify-center shrink-0 bg-stat-indigo-bg text-stat-indigo">
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
            <div className="text-[11px] text-text-2 mt-0.5">
              Elisym Agents
              <InfoTooltip text={TOOLTIP} />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="size-11 rounded-xl flex items-center justify-center shrink-0 bg-stat-emerald-bg text-stat-emerald">
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
            <div className="text-[11px] text-text-2 mt-0.5">
              Completed Jobs
              <InfoTooltip text={TOOLTIP} />
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
          <div className="size-11 rounded-xl flex items-center justify-center shrink-0 bg-stat-indigo-bg text-stat-indigo">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 3h12l3 6-9 12L3 9z" />
              <path d="M3 9h18" />
              <path d="M9 3l-1.5 6L12 21" />
              <path d="M15 3l1.5 6L12 21" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold leading-tight">
              {data ? `${new Decimal(data.totalLamports).div(1e9).toFixed(2)} SOL` : "—"}
            </div>
            <div className="text-[11px] text-text-2 mt-0.5">
              Total Volume
              <InfoTooltip text={TOOLTIP} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
