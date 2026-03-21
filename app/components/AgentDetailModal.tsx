import { useState } from "react";
import { formatSol, truncateKey } from "@elisym/sdk";
import type { CapabilityCard } from "@elisym/sdk";
import { useWallet } from "@solana/wallet-adapter-react";
import { nip19 } from "nostr-tools";
import { MarbleAvatar } from "./MarbleAvatar";
import { useBuyCapability } from "~/hooks/useBuyCapability";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";

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
            <CapabilityItem
              key={card.name}
              card={card}
              agentPubkey={agent.pubkey}
              agentName={agent.name}
              agentPicture={agent.picture}
            />
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

function CapabilityItem({
  card,
  agentPubkey,
  agentName,
  agentPicture,
}: {
  card: CapabilityCard;
  agentPubkey: string;
  agentName: string;
  agentPicture?: string;
}) {
  const price = card.payment?.job_price;
  const isStatic = card.static === true;
  const { publicKey } = useWallet();
  const { buy, buying, result, error } = useBuyCapability({
    agentPubkey,
    agentName,
    agentPicture,
    card,
  });
  const [input, setInput] = useState("");

  const hasPurchaseAction = price != null;

  function handleBuy() {
    if (isStatic) {
      buy();
    } else {
      buy(input);
    }
  }

  function buttonLabel() {
    if (buying) return "Processing...";
    if (!publicKey) return "Connect Wallet";
    return price != null ? `Buy for ${formatSol(price)}` : "Submit";
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-border overflow-hidden">
      {/* Large image on top */}
      {card.image && (
        <img
          src={card.image}
          alt={card.name}
          className="w-full h-48 object-cover"
        />
      )}

      <div className="p-4">
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

        {/* Purchase section */}
        {hasPurchaseAction && (
          <div className="mt-3">
            {result ? (
              <div className="p-3 bg-surface rounded-lg border border-border text-xs text-text leading-relaxed whitespace-pre-wrap">
                {result}
              </div>
            ) : (
              <>
                {!isStatic && (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe what you need..."
                    className="w-full py-2 px-3 rounded-lg border border-border bg-surface text-text text-xs outline-none resize-y min-h-[60px] font-[inherit] mb-2 transition-colors focus:border-accent"
                  />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBuy}
                    disabled={buying || !publicKey || (!isStatic && !input.trim())}
                    className="py-1.5 px-4 rounded-lg bg-accent text-white text-xs font-semibold border-none cursor-pointer hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {buttonLabel()}
                  </button>
                  {error && (
                    <span className="text-xs text-error truncate">{error}</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
