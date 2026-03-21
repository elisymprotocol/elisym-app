import { Link, useNavigate } from "react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { useIdentity } from "~/hooks/useIdentity";
import { ProfileCard } from "~/components/ProfileCard";
import { ProfileStats } from "~/components/ProfileStats";
import { OrderHistory } from "~/components/OrderHistory";
import { NostrKeys } from "~/components/NostrKeys";

export default function Profile() {
  const { npub, publicKey: nostrPubkey, allIdentities, activeId } = useIdentity();
  const { disconnect } = useWallet();
  const navigate = useNavigate();
  const activeKeyName = allIdentities.find((e) => e.id === activeId)?.name;

  return (
    <div className="max-w-[800px] mx-auto py-10 px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-text-2 no-underline text-sm font-medium mb-5 transition-colors hover:text-text"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Marketplace
      </Link>

      <ProfileCard npub={npub} pubkey={nostrPubkey} keyName={activeKeyName} />

      <div className="bg-surface border border-border rounded-2xl p-8 mb-6">
        <ProfileStats />
      </div>

      <OrderHistory />

      <NostrKeys />

      <button
        onClick={() => {
          void disconnect();
          void navigate("/");
        }}
        className="flex items-center gap-2 py-3 px-5 rounded-xl border border-border bg-surface text-error text-sm font-medium cursor-pointer hover:bg-surface-2 transition-colors mt-2"
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Log out
      </button>
    </div>
  );
}
