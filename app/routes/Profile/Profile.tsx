import { Link } from "react-router";
import { useIdentity } from "~/hooks/useIdentity";
import { ProfileCard } from "~/components/ProfileCard";
import { ProfileStats } from "~/components/ProfileStats";
import { OrderHistory } from "~/components/OrderHistory";
import { NostrKeys } from "~/components/NostrKeys";

export default function Profile() {
  const { npub, publicKey: nostrPubkey, allIdentities, activeId } = useIdentity();
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
    </div>
  );
}
