import { formatSol, truncateKey } from "@elisym/sdk";
import { nip19 } from "nostr-tools";
import { MarbleAvatar } from "./MarbleAvatar";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";
import type { CapabilityCard } from "@elisym/sdk";

interface AgentDetailModalProps {
  agent: AgentDisplayData;
  onClose: () => void;
}

export function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/25 z-[500] flex items-center justify-center backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-[18px] w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-full shrink-0 overflow-hidden flex items-center justify-center">
              {agent.picture ? (
                <img
                  src={agent.picture}
                  alt={agent.name}
                  className="size-full object-cover"
                />
              ) : (
                <MarbleAvatar name={agent.pubkey} size={56} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {agent.name || truncateKey(nip19.npubEncode(agent.pubkey), 8)}
              </h2>
              <div className="font-mono text-xs text-text-2 mt-0.5">
                {truncateKey(nip19.npubEncode(agent.pubkey))}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-text-2 text-[22px] cursor-pointer hover:text-text"
          >
            &#10005;
          </button>
        </div>

        {/* About */}
        {agent.description && (
          <div className="text-sm text-text-2 leading-relaxed mb-6">
            {agent.description}
          </div>
        )}

        {/* Capabilities */}
        <div className="text-sm font-semibold mb-3">
          Capabilities ({agent.cards.length})
        </div>

        <div className="flex flex-col gap-3">
          {agent.cards.map((card) => (
            <CapabilityItem key={card.name} card={card} />
          ))}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border text-xs text-text-2">
          {agent.walletAddress && (
            <span className="font-mono">{truncateKey(agent.walletAddress)}</span>
          )}
          <span>{agent.lastSeen}</span>
        </div>
      </div>
    </div>
  );
}

function CapabilityItem({ card }: { card: CapabilityCard }) {
  const price = card.payment?.job_price;

  return (
    <div className="p-4 bg-surface-2 rounded-xl border border-border">
      <div className="flex items-start gap-3">
        {card.image && (
          <img
            src={card.image}
            alt={card.name}
            className="w-16 h-16 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-sm font-semibold truncate">{card.name}</div>
            {price != null && (
              <div className="text-sm font-bold text-green shrink-0">
                {formatSol(price)}
              </div>
            )}
          </div>
          {card.description && (
            <div className="text-xs text-text-2 leading-relaxed mb-2">
              {card.description}
            </div>
          )}
          {card.capabilities.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {card.capabilities.map((tag) => (
                <span
                  key={tag}
                  className="py-0.5 px-2 bg-tag-bg rounded-md text-[11px] text-text-2 border border-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
