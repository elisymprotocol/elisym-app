import { useState } from "react";
import { truncateKey } from "@elisym/sdk";
import { track } from "~/lib/analytics";
import { nip19 } from "nostr-tools";
import { MarbleAvatar } from "./MarbleAvatar";
import { AgentDetailModal } from "./AgentDetailModal";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";

interface AgentCardProps {
  agent: AgentDisplayData;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <>
      <div
        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 280px" }}
        className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-accent hover:-translate-y-0.5 flex flex-col gap-3.5"
      >
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-full shrink-0 overflow-hidden flex items-center justify-center">
            {agent.picture ? (
              <img
                src={agent.picture}
                alt={agent.name}
                loading="lazy"
                className="size-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML = "";
                }}
              />
            ) : (
              <MarbleAvatar name={agent.pubkey} size={48} />
            )}
          </div>
          <div className="text-base font-semibold line-clamp-1 break-all min-w-0">
            {agent.name || truncateKey(nip19.npubEncode(agent.pubkey), 8)}
          </div>
        </div>

        <div className="text-text-2 text-sm leading-relaxed">
          {agent.description}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {agent.tags.map((tag) => (
            <span
              key={tag}
              className="py-1 px-2.5 bg-tag-bg rounded-md text-xs text-text-2 border border-border"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="flex justify-between items-center text-xs text-text-2">
          <span className="font-mono text-xs opacity-70">{agent.wallet}</span>
          <span>{agent.lastSeen}</span>
        </div>

        {(agent.purchases > 0 || agent.feedbackTotal > 0) && (
          <div className="flex items-center gap-2.5 text-[11px]">
            {agent.purchases > 0 && (
              <span className="flex items-center gap-1 py-0.5 px-2 rounded-full bg-[#f0f0ee] text-text-2">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                {agent.purchases}
              </span>
            )}
            {agent.feedbackPositive > 0 && (
              <span className="flex items-center gap-1 py-0.5 px-2 rounded-full bg-[#e8f5e9] text-[#4caf50]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66L14.17 2 7.59 8.59C7.22 8.95 7 9.45 7 10v8c0 1.1.9 2 2 2h9c.78 0 1.47-.46 1.79-1.11l2.04-4.63z"/></svg>
                {agent.feedbackPositive}
              </span>
            )}
            {agent.feedbackNegative > 0 && (
              <span className="flex items-center gap-1 py-0.5 px-2 rounded-full bg-[#fce4ec] text-[#ef5350]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h5.5l-.92 4.65c-.05.22-.02.46.08.66L9.83 22l6.58-6.59c.36-.36.59-.86.59-1.41V6c0-1.1-.9-2-2-2H6c-.78 0-1.47.46-1.79 1.11l-2.04 4.63z"/></svg>
                {agent.feedbackNegative}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-border">
          <div className="text-lg font-bold text-green">
            {agent.price}
            {agent.price !== "Free" && (
              <span className="text-xs text-text-2 font-normal"> per task</span>
            )}
          </div>
          <button
            onClick={() => { track("agent-details", { agent: agent.name }); setDetailOpen(true); }}
            className="py-2 px-5 rounded-[10px] border-none bg-accent text-white text-sm font-semibold cursor-pointer hover:bg-accent-hover transition-colors"
          >
            Details
          </button>
        </div>
      </div>

      {detailOpen && (
        <AgentDetailModal agent={agent} onClose={() => setDetailOpen(false)} />
      )}
    </>
  );
}
