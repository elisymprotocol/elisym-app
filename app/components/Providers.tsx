import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Filter } from "nostr-tools";
import { nip19 } from "nostr-tools";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { ElisymProvider, useElisymClient } from "@elisym/sdk/react";
import { usePendingJobSync, useHistorySync } from "@elisym/sdk/react";
import { toast } from "sonner";
import { truncateKey } from "@elisym/sdk";
import { resolveJobToast, hasJobToast } from "~/lib/jobToasts";
import { UIProvider, useUI } from "~/contexts/UIContext";
import { IdentityProvider, useOptionalIdentity } from "~/hooks/useIdentity";

const queryClient = new QueryClient();

function PendingJobSyncRunner() {
  usePendingJobSync();
  const { client } = useElisymClient();
  const [uiState] = useUI();
  const uiRef = useRef(uiState);
  uiRef.current = uiState;

  // Track message counts to detect new results from background sync
  const prevCountsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    return client.chatDb.onConversationChange(() => {
      void client.chatDb.getAllConversations().then((convos) => {
        for (const convo of convos) {
          const resultCount = convo.messages.filter((m) => m.type === "result").length;
          const prevCount = prevCountsRef.current.get(convo.agentPubkey) ?? 0;

          if (resultCount > prevCount && prevCount > 0) {
            const name = convo.agentName || truncateKey(nip19.npubEncode(convo.agentPubkey), 8);

            // Resolve the global loading toast if one exists for this agent
            if (hasJobToast(convo.agentPubkey)) {
              resolveJobToast(convo.agentPubkey, `${name}: result received`);
            } else if (uiRef.current.activeConversation !== convo.agentPubkey) {
              // No active loading toast — show a new success toast (unless viewing that chat)
              toast.success(`${name}: result received`);
            }
          }
          prevCountsRef.current.set(convo.agentPubkey, resultCount);
        }
      });
    });
  }, [client]);

  return null;
}

/** Keeps chatDb scoped to the active identity + listens for incoming DMs. */
function IdentitySync() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const pubkey = idCtx?.publicKey;
  const identity = idCtx?.identity;
  const [uiState] = useUI();

  // Switch chatDb to active identity synchronously — before any hooks read from it
  if (pubkey && client.chatDb.currentOwner !== pubkey) {
    client.chatDb.setOwner(pubkey);
  }

  // Sync chat history from relays (initial + catch-up)
  useHistorySync(identity);

  // Keep UI state in ref so subscription callback sees latest value
  const uiRef = useRef(uiState);
  uiRef.current = uiState;

  // Profile cache for sender names/pictures
  const profileCache = useRef<Map<string, { name: string; picture?: string }>>(new Map());

  // Per-sender cooldown for ping responses (1s)
  const lastPingRef = useRef<Map<string, number>>(new Map());

  // Global DM listener — re-subscribes when identity changes
  useEffect(() => {
    if (!identity) return;

    async function resolveProfile(pubkey: string) {
      const cached = profileCache.current.get(pubkey);
      if (cached) return cached;

      try {
        const events = await client.pool.querySync({
          kinds: [0],
          authors: [pubkey],
          limit: 1,
        } as Filter);
        if (events.length > 0) {
          const meta = JSON.parse(events[0]!.content);
          const profile = { name: meta.name || "", picture: meta.picture };
          profileCache.current.set(pubkey, profile);
          return profile;
        }
      } catch {
        // ignore
      }
      return { name: "", picture: undefined };
    }

    const sub = client.messaging.subscribeToMessages(
      identity,
      (senderPubkey: string, content: string, createdAt: number, rumorId: string) => {
        // Handle protocol messages
        try {
          const msg = JSON.parse(content);
          if (msg.type === "elisym_ping") {
            const now = Date.now();
            const lastPing = lastPingRef.current.get(senderPubkey) ?? 0;
            if (now - lastPing < 1000) return;
            lastPingRef.current.set(senderPubkey, now);
            const pong = JSON.stringify({ type: "elisym_pong", nonce: msg.nonce });
            void client.messaging.sendMessage(identity!, senderPubkey, pong);
            return;
          }
          if (msg.type === "elisym_pong") return;
        } catch {
          // not JSON — regular text
        }

        const ts = createdAt * 1000; // Nostr seconds → ms
        const isSelf = senderPubkey === identity!.publicKey;

        void resolveProfile(senderPubkey).then((profile) => {
          client.chatDb.appendMessages(
            senderPubkey,
            profile.name,
            profile.picture,
            [
              {
                type: isSelf ? "user" : "system",
                id: rumorId,
                ts,
                text: content,
              },
            ],
          );

          // Toast for incoming messages (skip if viewing that conversation)
          if (!isSelf && uiRef.current.activeConversation !== senderPubkey) {
            const name = profile.name || truncateKey(nip19.npubEncode(senderPubkey), 8);
            const preview = content.length > 60 ? content.slice(0, 60) + "…" : content;
            toast(`${name}: ${preview}`, { duration: 4000 });
          }
        });
      },
    );

    return () => sub.close();
  }, [client, identity]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <ElisymProvider config={{ network: "devnet" }}>
            <IdentityProvider>
              <UIProvider>
                <IdentitySync />
                <PendingJobSyncRunner />
                {children}
              </UIProvider>
            </IdentityProvider>
          </ElisymProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
