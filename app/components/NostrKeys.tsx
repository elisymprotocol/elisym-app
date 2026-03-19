import { useState, useCallback } from "react";
import { useIdentity } from "~/hooks/useIdentity";

export function NostrKeys() {
  const { npub, nsecEncode, regenerate } = useIdentity();
  const [nsecVisible, setNsecVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    async (type: "npub" | "nsec") => {
      const val = type === "npub" ? npub : nsecEncode();
      await navigator.clipboard.writeText(val);
      setCopyFeedback(type);
      setTimeout(() => setCopyFeedback(null), 1200);
    },
    [npub, nsecEncode],
  );

  function handleRegenerate() {
    if (!confirm("Generate new Nostr keypair? This will replace your current keys.")) {
      return;
    }
    regenerate();
    setNsecVisible(false);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-8">
      <div className="text-base font-semibold mb-5 flex items-center gap-2.5">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
        Nostr Keys
      </div>

      {/* npub */}
      <div className="flex items-center gap-3 p-3.5 px-4 bg-surface-2 rounded-[10px] mb-2.5 border border-border">
        <span className="text-xs font-semibold text-text-2 uppercase tracking-wider w-12 shrink-0">
          npub
        </span>
        <span className="flex-1 font-mono text-[12.5px] text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {copyFeedback === "npub" ? "Copied!" : npub}
        </span>
        <button
          onClick={() => void copyToClipboard("npub")}
          className="bg-transparent border-none text-text-2 cursor-pointer p-1 px-1.5 rounded-md transition-all hover:text-text hover:bg-border flex items-center"
          title="Copy"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>

      {/* nsec */}
      <div className="flex items-center gap-3 p-3.5 px-4 bg-surface-2 rounded-[10px] mb-2.5 border border-border">
        <span className="text-xs font-semibold text-text-2 uppercase tracking-wider w-12 shrink-0">
          nsec
        </span>
        <span
          className={`flex-1 font-mono text-[12.5px] overflow-hidden text-ellipsis whitespace-nowrap ${
            nsecVisible ? "text-text" : "text-text-2"
          }`}
        >
          {copyFeedback === "nsec"
            ? "Copied!"
            : nsecVisible
              ? nsecEncode()
              : "••••••••••••••••••••••••••"}
        </span>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setNsecVisible((v) => !v)}
            className="bg-transparent border-none text-text-2 cursor-pointer p-1 px-1.5 rounded-md transition-all hover:text-text hover:bg-border flex items-center"
            title="Show/Hide"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <button
            onClick={() => void copyToClipboard("nsec")}
            className="bg-transparent border-none text-text-2 cursor-pointer p-1 px-1.5 rounded-md transition-all hover:text-text hover:bg-border flex items-center"
            title="Copy"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      </div>

      <button onClick={handleRegenerate} className="btn btn-outline mt-3.5">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="inline align-[-2px] mr-1.5">
          <path d="M1 4v6h6" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
        Generate new keypair
      </button>
      <div className="text-xs text-text-2 mt-3 leading-relaxed">
        Your Nostr keys are used for agent discovery and task coordination via
        NIP-89/NIP-90 relays. Keep your nsec private.
      </div>
    </div>
  );
}
