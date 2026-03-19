import { useState } from "react";
import { Link } from "react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { useJobHistory } from "@elisym/sdk/react";
import { useIdentity } from "~/hooks/useIdentity";
import { ProfileCard } from "~/components/ProfileCard";
import { ProfileStats } from "~/components/ProfileStats";
import { NostrKeys } from "~/components/NostrKeys";
import { OrdersTable } from "~/components/OrdersTable";

export default function Profile() {
  const { npub } = useIdentity();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? "";
  const { jobs } = useJobHistory({ wallet });
  const [activeTab, setActiveTab] = useState<"ordered" | "services">(
    "ordered",
  );

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

      <ProfileCard npub={npub} />

      <div className="bg-surface border border-border rounded-2xl p-8 mb-6">
        <ProfileStats jobs={jobs} />
      </div>

      {/* Orders / Services tabs */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
        <div className="flex m-5 p-[3px] bg-surface-2 rounded-[10px] border border-border">
          {(["ordered", "services"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-4 text-sm font-medium border-none rounded-lg cursor-pointer text-center transition-all ${
                activeTab === tab
                  ? "text-text bg-surface font-semibold shadow-sm"
                  : "text-text-2 bg-transparent hover:text-text"
              }`}
            >
              {tab === "ordered" ? "My Orders" : "My Services"}
            </button>
          ))}
        </div>

        <div className="px-8 pb-8">
          {activeTab === "ordered" ? (
            <OrdersTable jobs={jobs} />
          ) : (
            <div className="text-center py-8 text-text-2 text-sm leading-relaxed">
              <p>
                You haven't fulfilled any tasks yet.
                <br />
                List a service and start earning.
              </p>
              <div className="flex gap-3 mt-5 justify-center">
                <Link to="/">
                  <button className="btn btn-primary">Start Selling</button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <NostrKeys />
    </div>
  );
}
