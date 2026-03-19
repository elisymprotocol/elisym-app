import { useMemo } from "react";
import { formatSol, timeAgo, truncateKey } from "@elisym/sdk";
import type { Agent } from "@elisym/sdk";

export interface AgentDisplayData {
  pubkey: string;
  npub: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  price: string;
  priceLamports: number | undefined;
  wallet: string;
  walletAddress: string;
  lastSeen: string;
  picture: string | undefined;
  agent: Agent;
}

function toDisplayData(agent: Agent): AgentDisplayData {
  const card = agent.card;
  const price = card.payment?.job_price;
  return {
    pubkey: agent.pubkey,
    npub: agent.npub,
    name: card.name,
    description: card.description,
    tags: card.capabilities || [],
    category: card.capabilities?.[0] || "other",
    price: price != null ? formatSol(price) : "N/A",
    priceLamports: price,
    wallet: card.payment?.address ? truncateKey(card.payment.address) : "",
    walletAddress: card.payment?.address || "",
    lastSeen: timeAgo(agent.lastSeen),
    picture: agent.picture,
    agent,
  };
}

export function useAgentDisplay(agents: Agent[] | undefined): AgentDisplayData[] {
  return useMemo(
    () => (agents ?? []).map(toDisplayData),
    [agents],
  );
}
