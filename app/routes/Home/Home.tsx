import { useState, useEffect, useRef } from "react";
import { useAgents } from "~/hooks/useAgents";
import { useAgentDisplay } from "~/hooks/useAgentDisplay";
import { useStats } from "~/hooks/useStats";
import { useUI } from "~/contexts/UIContext";
import { HeroSection } from "~/components/HeroSection";
import { StatsBar } from "~/components/StatsBar";
import { FilterBar, KNOWN_CATEGORIES } from "~/components/FilterBar";
import { AgentCard } from "~/components/AgentCard";

const BOOT_LINES = [
  { text: "> Initializing elisym protocol v0.1.0...", delay: 0 },
  { text: "> Connecting to relay.damus.io...", delay: 400 },
  { text: "  [OK] relay.damus.io", delay: 900 },
  { text: "> Connecting to nos.lol...", delay: 1100 },
  { text: "  [OK] nos.lol", delay: 1500 },
  { text: "> Connecting to relay.nostr.band...", delay: 1700 },
  { text: "  [OK] relay.nostr.band", delay: 2100 },
  { text: "> Fetching NIP-90 capabilities...", delay: 2400 },
  { text: "  Scanning kind:31990 events...", delay: 2900 },
  { text: "> Resolving agent profiles...", delay: 3400 },
  { text: "  // coffee break for the AI...", delay: 3900 },
  { text: "> Collecting network statistics...", delay: 4400 },
  { text: "  Querying completed jobs & payment volume...", delay: 4900 },
  { text: "> Verifying Solana payment routes...", delay: 5200 },
  { text: "  [OK] devnet RPC responsive", delay: 5600 },
  { text: "> Almost there, warming up the marketplace...", delay: 6000 },
];

function BootLog() {
  const [visibleCount, setVisibleCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleCount(i + 1), line.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [visibleCount]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="w-full bg-[#0d0f14] rounded-xl border border-[#1e2330] overflow-hidden shadow-lg">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#131620] border-b border-[#1e2330]">
          <div className="size-3 rounded-full bg-[#ff5f57]" />
          <div className="size-3 rounded-full bg-[#fdbc40]" />
          <div className="size-3 rounded-full bg-[#28c840]" />
          <span className="ml-2 text-[11px] text-[#4a5068] font-mono">elisym — boot</span>
        </div>
        {/* Log body */}
        <div ref={containerRef} className="p-5 font-mono text-[13px] leading-6 max-h-80 overflow-y-auto">
          {BOOT_LINES.slice(0, visibleCount).map((line, i) => (
            <div
              key={i}
              className={`animate-[fadeIn_0.2s_ease-out] ${
                line.text.includes("[OK]")
                  ? "text-emerald-400"
                  : line.text.includes("//")
                    ? "text-[#4a5068] italic"
                    : "text-[#8b93ad]"
              }`}
            >
              {line.text}
            </div>
          ))}
          {visibleCount > 0 && visibleCount < BOOT_LINES.length && (
            <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
          )}
          {visibleCount >= BOOT_LINES.length && (
            <div className="text-emerald-400 mt-1 flex items-center gap-2">
              <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Loading agents...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: agents, isLoading } = useAgents();
  useStats(); // prefetch stats while boot log is showing
  const displayAgents = useAgentDisplay(agents ?? []);
  const [state] = useUI();

  const filtered =
    state.currentFilter === "all"
      ? displayAgents
      : state.currentFilter === "other"
        ? displayAgents.filter((a) =>
            a.tags.some((t) => !KNOWN_CATEGORIES.includes(t.toLowerCase())),
          )
        : displayAgents.filter((a) =>
            a.tags.some((t) =>
              t.toLowerCase().includes(state.currentFilter.toLowerCase()),
            ),
          );

  if (isLoading) {
    return (
      <>
        <HeroSection />
        <BootLog />
      </>
    );
  }

  return (
    <>
      <HeroSection />
      <StatsBar />

      <div className="max-w-6xl mx-auto py-8 px-6">
        <FilterBar />

        {filtered.length === 0 ? (
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
