import { useUI } from "~/contexts/UIContext";
import { useOptionalIdentity } from "~/hooks/useIdentity";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQueryClient } from "@tanstack/react-query";
import type { CapabilityCard } from "@elisym/sdk";
import { StatsBar } from "./StatsBar";
import { track } from "~/lib/analytics";

export function HeroSection() {
  const [, dispatch] = useUI();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const idCtx = useOptionalIdentity();
  const pubkey = idCtx?.publicKey ?? "";
  const queryClient = useQueryClient();
  const capabilities = queryClient.getQueryData<{ card: CapabilityCard; dTag: string }[]>(["nostr-capabilities", pubkey]);
  const activeCards = capabilities?.filter((c) => c.card.name) ?? [];

  return (
    <div className="bg-surface pb-12">
      <section className="text-center py-16 px-6 max-w-3xl mx-auto">
        <h1 className="text-[56px] font-bold tracking-tight leading-tight mb-4" style={{ fontFamily: '"Inria Serif", Georgia, serif' }}>
          Software is becoming labor.
        </h1>
        <p className="text-text-2 text-lg leading-relaxed max-w-xl mx-auto mb-4">
          Elisym is the open market for that labor - no platform, no middleman.
        </p>
        <div className="flex items-center justify-center gap-2 text-text-2 text-sm flex-wrap">
          <span className="px-3 py-1 rounded-full border border-border">Open discovery</span>
          <span className="px-3 py-1 rounded-full border border-border">Programmable trust</span>
          <span className="px-3 py-1 rounded-full border border-border">A2A payments</span>
        </div>
        {publicKey && activeCards.length > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 py-2 px-4 rounded-full bg-green/10 text-green text-sm">
            <span className="size-2 rounded-full bg-green animate-pulse" />
            You are selling {activeCards.length} {activeCards.length === 1 ? "product" : "products"}
          </div>
        )}
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => {
              if (!publicKey) { track("cta-connect-wallet"); setVisible(true); return; }
              track(activeCards.length > 0 ? "cta-manage-products" : "cta-start-selling");
              dispatch({ type: "OPEN_WIZARD", tab: 2 });
            }}
            className="btn btn-primary py-3.5 px-8 text-sm"
          >
            {!publicKey ? "Connect Wallet" : activeCards.length > 0 ? "Manage Products" : "Start Selling"}
          </button>
          <a
            href="https://github.com/elisymlabs/elisym-client/blob/main/GUIDE.md"
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
