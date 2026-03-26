import { useState, useEffect, useRef, useCallback, useMemo, useDeferredValue } from "react";
import { useAgents } from "~/hooks/useAgents";
import { useAgentDisplay } from "~/hooks/useAgentDisplay";
import { useAgentFeedback } from "~/hooks/useAgentFeedback";
import { useStats } from "~/hooks/useStats";
import { useUI } from "~/contexts/UIContext";
import { HeroSection } from "~/components/HeroSection";
import { FilterBar, KNOWN_CATEGORIES } from "~/components/FilterBar";
import { AgentCard } from "~/components/AgentCard";

const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
  "wss://purplepag.es",
];

/** Build page numbers with ellipsis: [1, '...', 4, 5, 6, '...', 20] */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

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

    push({ text: "> Initializing elisym market v0.1.0...", type: "info" });

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
      push({ text: `  (${connected}/${RELAYS.length} relays online — ${connected >= 2 ? "sufficient" : "degraded"})`, type: connected >= 2 ? "ok" : "info" });
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
      push({ text: "> Market ready. Welcome to elisym.", type: "ok" });
    }
  }, [agentsLoaded, statsLoaded, push]);

  return lines;
}

function BootLog({ lines }: { lines: LogLine[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isComplete = lines.length > 0 && lines[lines.length - 1]?.type === "ok"
    && lines[lines.length - 1]?.text.includes("Market ready");

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
  }, [lines.length]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="w-full bg-[#f5f3f0] rounded-xl border border-[#e0dbd5] overflow-hidden shadow-sm">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#ece8e3] border-b border-[#e0dbd5]">
          <div className="size-3 rounded-full bg-[#f4a5a0]" />
          <div className="size-3 rounded-full bg-[#f2d48f]" />
          <div className="size-3 rounded-full bg-[#a3d9a5]" />
          <span className="ml-2 text-[11px] text-[#a09888] font-mono">elisym — boot</span>
        </div>
        {/* Log body */}
        <div ref={containerRef} className="p-5 font-mono text-[13px] leading-6 max-h-80 overflow-y-auto">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`animate-[fadeIn_0.2s_ease-out] ${
                line.type === "ok"
                  ? "text-[#5a9e6f]"
                  : line.type === "error"
                    ? "text-[#c97067]"
                    : line.type === "comment"
                      ? "text-[#b8ad9e] italic"
                      : "text-[#6b6356]"
              }`}
            >
              {line.text}
            </div>
          ))}
          {!isComplete && (
            <span className="inline-block w-2 h-4 bg-[#5a9e6f] animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 18;

export default function Home() {
  const { data: agents, isLoading: agentsLoading, fromCache: agentsFromCache } = useAgents();
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: feedbackMap } = useAgentFeedback();
  const displayAgents = useAgentDisplay(agents ?? [], feedbackMap);
  const [state] = useUI();
  const [page, setPage] = useState(1);

  // Cold start = no cached data at all
  const isColdStart = agentsLoading && !agentsFromCache;

  // Boot log only runs on cold start
  const bootLines = useBootLog(!agentsLoading, !statsLoading);


  const filteredUnsorted =
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

  const filtered = useMemo(() => {
    const TEN_MINUTES = 10 * 60;
    const now = Math.floor(Date.now() / 1000);

    const positiveRate = (a: typeof filteredUnsorted[number]) =>
      a.feedbackTotal > 0 ? a.feedbackPositive / a.feedbackTotal : 0;

    // Split into online (last 10 min) and the rest
    const online = filteredUnsorted.filter((a) => now - a.lastSeenTs < TEN_MINUTES);
    const rest = filteredUnsorted.filter((a) => now - a.lastSeenTs >= TEN_MINUTES);

    // Online: sort by positive rating % descending, tiebreak by lastSeen
    online.sort((a, b) => {
      const rateDiff = positiveRate(b) - positiveRate(a);
      if (rateDiff !== 0) return rateDiff;
      return b.lastSeenTs - a.lastSeenTs;
    });

    // Rest: sort by lastSeen descending
    rest.sort((a, b) => b.lastSeenTs - a.lastSeenTs);

    return [...online, ...rest];
  }, [filteredUnsorted]);

  // Reset to page 1 when filter changes
  const prevFilter = useRef(state.currentFilter);
  useEffect(() => {
    if (prevFilter.current !== state.currentFilter) {
      prevFilter.current = state.currentFilter;
      setPage(1);
    }
  }, [state.currentFilter]);

  const deferredFiltered = useDeferredValue(filtered);
  const totalPages = Math.max(1, Math.ceil(deferredFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = deferredFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

      <div className="max-w-6xl mx-auto py-8 px-6">
        <FilterBar />

        {filtered.length === 0 ? (
          <p className="text-text-2 text-center py-15">
            No agents found for this category.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
              {paged.map((agent) => (
                <AgentCard key={agent.pubkey} agent={agent} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-8">
                {getPageNumbers(safePage, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`dot-${i}`} className="size-9 flex items-center justify-center text-sm text-text-2">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={`size-9 rounded-lg border text-sm font-medium transition-colors ${
                        p === safePage
                          ? "bg-accent border-accent text-white"
                          : "bg-surface border-border text-text-2 hover:border-accent hover:text-text"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
