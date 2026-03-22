import { useState } from "react";
import { formatSol, truncateKey } from "@elisym/sdk";
import { track } from "~/lib/analytics";
import type { CapabilityCard } from "@elisym/sdk";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { nip19 } from "nostr-tools";
import { MarbleAvatar } from "./MarbleAvatar";
import { useBuyCapability } from "~/hooks/useBuyCapability";
import { useOptionalIdentity } from "~/hooks/useIdentity";
import { usePingAgent, type PingStatus } from "~/hooks/usePingAgent";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";

interface AgentDetailModalProps {
  agent: AgentDisplayData;
  onClose: () => void;
}

const STATUS_DOT: Record<PingStatus, string> = {
  pinging: "bg-yellow-400 animate-pulse",
  online: "bg-emerald-500",
  offline: "bg-red-400",
};

export function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  const idCtx = useOptionalIdentity();
  const isOwn = idCtx?.publicKey === agent.pubkey;
  const pingedStatus = usePingAgent(isOwn ? "" : agent.pubkey);
  const pingStatus: PingStatus = isOwn ? "online" : pingedStatus;

  return (
    <div
      className="fixed inset-0 bg-black/25 z-[500] flex items-center justify-center backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-[18px] w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-8 flex items-center justify-center rounded-full bg-surface-2 border-none text-text-2 cursor-pointer hover:bg-surface-2/80 hover:text-text transition-colors z-10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        {/* Header */}
        <div className="flex items-start mb-6 gap-3 pr-8">
          <div className="flex items-start gap-4 min-w-0">
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
            <div className="min-w-0">
              <h2 className="text-xl font-bold flex items-start gap-2">
                <span>
                  {(() => { const n = agent.name || truncateKey(nip19.npubEncode(agent.pubkey), 8); return n.length > 100 ? n.slice(0, 100) + "..." : n; })()}
                </span>
                <span className={`size-2.5 rounded-full shrink-0 mt-2 ${STATUS_DOT[pingStatus]}`} />
              </h2>
              <div className="font-mono text-xs text-text-2 mt-0.5">
                {truncateKey(nip19.npubEncode(agent.pubkey))}
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        {agent.description && (
          <div className="text-sm text-text-2 leading-relaxed mb-6">
            {agent.description.length > 280
              ? agent.description.slice(0, 280) + "..."
              : agent.description}
          </div>
        )}

        {/* Products */}
        <div className="text-sm font-semibold mb-3">
          Products ({agent.cards.length})
        </div>

        <div className="flex flex-col gap-3">
          {agent.cards.map((card) => (
            <CapabilityItem
              key={card.name}
              card={card}
              agentPubkey={agent.pubkey}
              agentName={agent.name}
              agentPicture={agent.picture}
              pingStatus={pingStatus}
            />
          ))}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-border text-xs text-text-2">
          {agent.walletAddress && (
            <span className="font-mono">
              <span className="text-text-2 font-sans font-medium mr-1.5">Wallet</span>
              {truncateKey(agent.walletAddress)}
            </span>
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
  pingStatus,
}: {
  card: CapabilityCard;
  agentPubkey: string;
  agentName: string;
  agentPicture?: string;
  pingStatus: PingStatus;
}) {
  const price = card.payment?.job_price;
  const isStatic = card.static === true;
  console.log(`[CapabilityItem] ${card.name}: payment=${JSON.stringify(card.payment)}, price=${price}, static=${isStatic}`);
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const idCtx = useOptionalIdentity();
  const isOwn = idCtx?.publicKey === agentPubkey;
  const { buy, buying, result, error, rate, rated } = useBuyCapability({
    agentPubkey,
    agentName,
    agentPicture,
    card,
  });
  const [input, setInput] = useState("");

  const hasPurchaseAction = price != null;

  const isFree = price === 0;

  function handleBuy() {
    if (!isFree && !publicKey) {
      track("wallet-connect", { source: "agent-modal" });
      setVisible(true);
      return;
    }
    track("buy", { agent: agentName, price: price ? formatSol(price) : "free" });
    if (isStatic) {
      buy(card.name);
    } else {
      buy(input);
    }
  }

  function buttonLabel() {
    if (buying) return "Processing...";
    if (!isFree && !publicKey) return "Connect Wallet";
    if (price != null) return price === 0 ? "Get for Free" : `Buy for ${formatSol(price)}`;
    return "Submit";
  }

  return (
    <div className="bg-surface-2 rounded-xl border border-border overflow-hidden">
      {/* Large image on top */}
      {card.image && (
        <img
          src={card.image}
          alt={card.name}
          className="w-full h-96 object-cover"
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-sm font-semibold line-clamp-2 break-all">
            {card.name}
          </div>
          {price != null && (
            <div className="text-sm font-bold text-green shrink-0">
              {formatSol(price)}
            </div>
          )}
        </div>
        {card.description && (
          <div className="text-xs text-text-2 leading-relaxed mb-2 line-clamp-2 break-all">
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
        {hasPurchaseAction && !isOwn && (
          <div className="mt-3">
            {result ? (
              <div>
                <div className="p-3 bg-surface rounded-lg border border-border text-xs text-text leading-relaxed whitespace-pre-wrap">
                  {result}
                </div>
                {rated ? (
                  <p className="text-[11px] text-text-2 mt-2">Thanks for your feedback</p>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => rate(true)}
                      className="py-1 px-3 rounded-lg border border-border bg-surface text-xs text-text-2 cursor-pointer hover:border-green hover:text-green transition-colors"
                    >
                      👍 Good
                    </button>
                    <button
                      onClick={() => rate(false)}
                      className="py-1 px-3 rounded-lg border border-border bg-surface text-xs text-text-2 cursor-pointer hover:border-error hover:text-error transition-colors"
                    >
                      👎 Bad
                    </button>
                  </div>
                )}
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
                  <span className="relative group">
                    <button
                      onClick={handleBuy}
                      disabled={buying || ((!!publicKey || isFree) && !isStatic && !input.trim()) || ((!!publicKey || isFree) && pingStatus !== "online")}
                      className="py-1.5 px-4 rounded-lg bg-accent text-white text-xs font-semibold border-none cursor-pointer hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {buttonLabel()}
                    </button>
                    {!!publicKey && pingStatus !== "online" && !buying && (
                      <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 rounded-lg bg-[#1a1a2e] px-3 py-2 text-xs text-gray-100 leading-relaxed shadow-lg z-50 pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        {pingStatus === "pinging" ? "Checking..." : "Provider is offline"}
                        <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1a1a2e]" />
                      </span>
                    )}
                  </span>
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
