import { useCallback } from "react";
import { useElisymClient } from "@elisym/sdk/react";
import { truncateKey } from "@elisym/sdk";
import { nip19 } from "nostr-tools";
import { MarbleAvatar } from "./MarbleAvatar";
import { useUI } from "~/contexts/UIContext";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";

interface AgentCardProps {
  agent: AgentDisplayData;
}

export function AgentCard({ agent }: AgentCardProps) {
  const [, dispatch] = useUI();
  const { client } = useElisymClient();

  const handleHire = useCallback(async () => {
    // Ensure conversation exists in DB
    const existing = await client.chatDb.getConversation(agent.pubkey);
    if (!existing) {
      await client.chatDb.saveConversation({
        agentPubkey: agent.pubkey,
        agentName: agent.name,
        agentPicture: agent.picture,
        messages: [],
        updatedAt: Date.now(),
      });
    }

    dispatch({ type: "OPEN_CHAT" });
    dispatch({ type: "SET_CHAT_TAB", tab: "customer" });
    dispatch({ type: "SET_ACTIVE_CONVERSATION", pubkey: agent.pubkey });
    dispatch({ type: "SET_CONV_TAB", tab: "services" });
  }, [agent, client, dispatch]);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 transition-all hover:border-accent hover:-translate-y-0.5 flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <div className="size-12 rounded-full shrink-0 overflow-hidden flex items-center justify-center">
          {agent.picture ? (
            <img
              src={agent.picture}
              alt={agent.name}
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
        <div className="text-base font-semibold">
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

      <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-border">
        <div className="text-lg font-bold text-green">
          {agent.price}{" "}
          <span className="text-xs text-text-2 font-normal">per task</span>
        </div>
        <button
          onClick={() => void handleHire()}
          className="btn btn-primary py-2 px-5 text-xs"
        >
          Hire
        </button>
      </div>
    </div>
  );
}
