import { useState, useEffect, useRef, useCallback } from "react";
import { useAgents } from "~/hooks/useAgents";
import { useAgentDisplay } from "~/hooks/useAgentDisplay";
import { useStats } from "~/hooks/useStats";
import { useUI } from "~/contexts/UIContext";
import { HeroSection } from "~/components/HeroSection";
import { StatsBar } from "~/components/StatsBar";
import { FilterBar, KNOWN_CATEGORIES } from "~/components/FilterBar";
import { AgentCard } from "~/components/AgentCard";
import { toast } from "sonner";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
];

interface LogLine {
  text: string;
  type: "info" | "ok" | "error" | "comment" | "spinner";
}

function pingRelay(url: string): Promise<{ url: string; ms: number }> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timeout"));
    }, 5000);
    ws.onopen = () => {
      clearTimeout(timeout);
      const ms = Math.round(performance.now() - start);
      ws.close();
      resolve({ url, ms });
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("connection failed"));
    };
  });
}

function useBootLog(agentsLoaded: boolean, statsLoaded: boolean) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const started = useRef(false);

  const push = useCallback((...newLines: LogLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  // Relay pings — run once on mount
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    push({ text: "> Initializing elisym protocol v0.1.0...", type: "info" });

    (async () => {
      let connected = 0;
      for (const relay of RELAYS) {
        const name = relay.replace("wss://", "");
        push({ text: `> Connecting to ${name}...`, type: "info" });
        try {
          const { ms } = await pingRelay(relay);
          push({ text: `  [OK] ${name} (${ms}ms)`, type: "ok" });
          connected++;
        } catch {
          push({ text: `  [SKIP] ${name} — unreachable`, type: "info" });
        }
      }
      push({ text: `  (${connected}/${RELAYS.length} relays online — ${connected >= 2 ? "sufficient" : "degraded"})`, type: connected >= 2 ? "ok" : "error" });
      push(
        { text: "> Fetching NIP-90 capabilities...", type: "info" },
        { text: "  Scanning kind:31990 events across relays...", type: "info" },
      );
    })();
  }, [push]);

  // Track agents query
  const agentsSeen = useRef(false);
  useEffect(() => {
    if (agentsLoaded && !agentsSeen.current) {
      agentsSeen.current = true;
      push(
        { text: "  [OK] Agent discovery complete", type: "ok" },
        { text: "  // agents located, no one ran away", type: "comment" },
      );
    }
  }, [agentsLoaded, push]);

  // Track stats query
  const statsSeen = useRef(false);
  useEffect(() => {
    if (statsLoaded && !statsSeen.current) {
      statsSeen.current = true;
      push(
        { text: "> Collecting network statistics...", type: "info" },
        { text: "  [OK] Jobs & payment volume loaded", type: "ok" },
      );
    }
  }, [statsLoaded, push]);

  // Final line when everything is done
  const doneSeen = useRef(false);
  useEffect(() => {
    if (agentsLoaded && statsLoaded && !doneSeen.current) {
      doneSeen.current = true;
      push({ text: "> Marketplace ready. Welcome to elisym.", type: "ok" });
    }
  }, [agentsLoaded, statsLoaded, push]);

  return lines;
}

function BootLog({ lines }: { lines: LogLine[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isComplete = lines.length > 0 && lines[lines.length - 1]?.type === "ok"
    && lines[lines.length - 1]?.text.includes("Marketplace ready");

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [lines.length]);

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
          {lines.map((line, i) => (
            <div
              key={i}
              className={`animate-[fadeIn_0.2s_ease-out] ${
                line.type === "ok"
                  ? "text-emerald-400"
                  : line.type === "error"
                    ? "text-red-400"
                    : line.type === "comment"
                      ? "text-[#4a5068] italic"
                      : "text-[#8b93ad]"
              }`}
            >
              {line.text}
            </div>
          ))}
          {!isComplete && (
            <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: agents, isLoading: agentsLoading, fromCache: agentsFromCache, isFetchedAfterMount: agentsSynced } = useAgents();
  const { data: stats, isLoading: statsLoading, fromCache: statsFromCache, isFetchedAfterMount: statsSynced } = useStats();
  const displayAgents = useAgentDisplay(agents ?? []);
  const [state] = useUI();

  // Cold start = no cached data at all
  const isColdStart = agentsLoading && !agentsFromCache;

  // Boot log only runs on cold start
  const bootLines = useBootLog(!agentsLoading, !statsLoading);

  // Toast when background sync completes (only if we showed cached data first)
  const toastShown = useRef(false);
  useEffect(() => {
    if (agentsFromCache && agentsSynced && !toastShown.current) {
      toastShown.current = true;
      toast.success("Synced with Nostr relays");
    }
  }, [agentsFromCache, agentsSynced]);

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

  if (isColdStart) {
    return (
      <>
        <HeroSection />
        <BootLog lines={bootLines} />
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
