import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { useWallet } from "@solana/wallet-adapter-react";
import { truncateKey } from "@elisym/sdk";
import { MarbleAvatar } from "./MarbleAvatar";

export function Header() {
  const { publicKey, select, connect, disconnect, wallets } = useWallet();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const address = publicKey?.toBase58();
  const display = address ? truncateKey(address) : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  async function handleSignIn() {
    try {
      if (wallets.length > 0 && wallets[0]) {
        select(wallets[0].adapter.name);
      }
      await connect();
    } catch (_err) {
      // User rejected or wallet not installed
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

      <div className="relative flex items-center gap-3" ref={dropdownRef}>
        {display ? (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((v) => !v);
              }}
              className="flex items-center gap-2 py-1 pl-1 pr-3.5 rounded-lg border border-border cursor-pointer transition-all bg-surface hover:border-accent"
            >
              <div className="size-6.5 rounded-full overflow-hidden">
                <MarbleAvatar name={display} size={26} />
              </div>
              <span className="font-mono text-xs font-medium">
                {display}
              </span>
            </button>

            {dropdownOpen && (
              <div className="absolute top-full mt-2 right-0 bg-surface border border-border rounded-xl shadow-lg min-w-44 z-50 overflow-hidden">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-4 py-3 text-sm cursor-pointer hover:bg-surface-2 text-text no-underline"
                  onClick={() => setDropdownOpen(false)}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  Profile
                </Link>
                <button
                  onClick={() => {
                    void disconnect();
                    setDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-3 text-sm cursor-pointer hover:bg-surface-2 text-error w-full text-left border-none bg-transparent"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Log out
                </button>
              </div>
            )}
          </>
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
