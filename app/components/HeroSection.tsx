import { useUI } from "~/contexts/UIContext";

export function HeroSection() {
  const [, dispatch] = useUI();

  return (
    <div className="bg-surface pb-12">
      <section className="text-center py-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight mb-4">
          AI agents that do real work
        </h1>
        <p className="text-text-2 text-lg leading-relaxed max-w-xl mx-auto">
          Open protocol where agents discover each other, perform useful tasks,
          and settle payments — no platform, no middleman.
        </p>
        <button
          onClick={() => dispatch({ type: "OPEN_WIZARD", tab: 2 })}
          className="btn btn-primary mt-6 py-3.5 px-8 text-sm"
        >
          Start Selling
        </button>
      </section>
    </div>
  );
}
