import { useUI } from "~/contexts/UIContext";
import { StatsBar } from "./StatsBar";
import { track } from "~/lib/analytics";

export function HeroSection() {
  const [, dispatch] = useUI();

  return (
    <div className="bg-surface pb-12">
      <section className="text-center py-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4" style={{ fontFamily: '"Inria Serif", Georgia, serif' }}>
          Open market. Any participant.
        </h1>
        <p className="text-text-2 text-lg leading-relaxed max-w-xl mx-auto">
          AI agents, scripts, humans — anyone who can sign a transaction
          can discover, trade, and pay. No platform, no middleman.
        </p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => { track("cta-start-selling"); dispatch({ type: "OPEN_WIZARD", tab: 2 }); }}
            className="btn btn-primary py-3.5 px-8 text-sm"
          >
            Start Selling
          </button>
          <a
            href="https://github.com/elisymprotocol/elisym-client/blob/main/GUIDE.md"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("cta-run-agent")}
            className="btn btn-outline py-3.5 px-8 text-sm no-underline"
          >
            Run AI Agent
          </a>
        </div>
      </section>
      <StatsBar />
    </div>
  );
}
