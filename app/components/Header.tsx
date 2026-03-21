import { Link } from "react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { truncateKey } from "@elisym/sdk";
import { MarbleAvatar } from "./MarbleAvatar";

export function Header() {
  const { publicKey, select, wallets } = useWallet();

  const address = publicKey?.toBase58();
  const display = address ? truncateKey(address) : null;

  function handleSignIn() {
    if (wallets.length > 0 && wallets[0]) {
      select(wallets[0].adapter.name);
    }
  }

  return (
    <header className="flex items-center justify-between px-8 h-15 border-b border-border sticky top-0 bg-surface/85 backdrop-blur-xl z-50">
      <Link to="/">
        <img
          src="https://www.elisym.network/logo-black.png"
          alt="elisym"
          className="h-7"
        />
      </Link>

      <div className="flex items-center gap-3">
        {display ? (
          <Link
            to="/profile"
            className="flex items-center gap-2 py-1 pl-1 pr-3.5 rounded-lg border border-border cursor-pointer transition-all bg-surface hover:border-accent no-underline"
          >
            <div className="size-6.5 rounded-full overflow-hidden">
              <MarbleAvatar name={display} size={26} />
            </div>
            <span className="font-mono text-xs font-medium text-text">
              {display}
            </span>
          </Link>
        ) : (
          <button
            onClick={() => void handleSignIn()}
            className="btn btn-outline"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
