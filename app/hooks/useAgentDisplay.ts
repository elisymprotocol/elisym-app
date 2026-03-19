import { useMemo } from "react";
import { formatSol, timeAgo, truncateKey } from "@elisym/sdk";
import type { Agent, CapabilityCard } from "@elisym/sdk";

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
  cards: CapabilityCard[];
  agent: Agent;
}

function toDisplayData(agent: Agent): AgentDisplayData {
  const cards = agent.cards;
  const firstCard = cards[0];

  // Use agent-level name/about from kind:0, fallback to first card
  const name = agent.name || firstCard?.name || "Unknown";
  const description = agent.about || firstCard?.description || "";

  // Collect all tags from all cards
  const allTags = Array.from(
    new Set(cards.flatMap((c) => c.capabilities || [])),
  );

  // Find the first card with payment info for price display
  const cardWithPayment = cards.find((c) => c.payment?.job_price != null);
  const price = cardWithPayment?.payment?.job_price;

  // Find any card with a wallet address
  const cardWithAddress = cards.find((c) => c.payment?.address);
  const walletAddress = cardWithAddress?.payment?.address || "";

  return {
    pubkey: agent.pubkey,
    npub: agent.npub,
    name,
    description,
    tags: allTags,
    category: allTags[0] || "other",
    price: price != null ? formatSol(price) : "N/A",
    priceLamports: price,
    wallet: walletAddress ? truncateKey(walletAddress) : "",
    walletAddress,
    lastSeen: timeAgo(agent.lastSeen),
    picture: agent.picture,
    cards,
    agent,
  };
}

export function useAgentDisplay(agents: Agent[] | undefined): AgentDisplayData[] {
  return useMemo(
    () => (agents ?? []).map(toDisplayData),
    [agents],
  );
}
