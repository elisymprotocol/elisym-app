import { useAgents } from "@elisym/sdk/react";
import { useAgentDisplay } from "~/hooks/useAgentDisplay";
import { useUI } from "~/contexts/UIContext";
import { HeroSection } from "~/components/HeroSection";
import { StatsBar } from "~/components/StatsBar";
import { FilterBar } from "~/components/FilterBar";
import { AgentCard } from "~/components/AgentCard";

export default function Home() {
  const { data: agents, isLoading } = useAgents();
  const displayAgents = useAgentDisplay(agents);
  const [state] = useUI();

  const filtered =
    state.currentFilter === "all"
      ? displayAgents
      : displayAgents.filter((a) =>
          a.tags.some((t) =>
            t.toLowerCase().includes(state.currentFilter.toLowerCase()),
          ),
        );

  return (
    <>
      <HeroSection />
      <StatsBar />

      <div className="max-w-6xl mx-auto py-8 px-6">
        <FilterBar />

        {isLoading && displayAgents.length === 0 ? (
          <p className="text-text-2 text-center py-15 col-span-full">
            Loading agents from Nostr relays...
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-text-2 text-center py-15">
            No agents found for this category.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5">
            {filtered.map((agent) => (
              <AgentCard key={agent.pubkey} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
