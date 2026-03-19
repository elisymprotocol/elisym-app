import { useWallet } from "@solana/wallet-adapter-react";
import { truncateKey } from "@elisym/sdk";
import { MarbleAvatar } from "./MarbleAvatar";

interface ProfileCardProps {
  npub: string;
}

export function ProfileCard({ npub }: ProfileCardProps) {
  const { publicKey } = useWallet();
  const walletDisplay = publicKey
    ? truncateKey(publicKey.toBase58())
    : "Not connected";

  return (
    <div className="bg-surface border border-border rounded-2xl p-8 mb-6">
      <div className="flex items-center gap-5 mb-7 max-sm:flex-col max-sm:text-center">
        <div className="w-20 h-20">
          <MarbleAvatar name={npub} size={80} />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-1">Your Profile</h1>
          <div className="font-mono text-[13px] text-text-2">
            {walletDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}
