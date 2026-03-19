import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Filter } from "nostr-tools";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { ElisymProvider, useElisymClient } from "@elisym/sdk/react";
import { usePendingJobSync } from "@elisym/sdk/react";
import { UIProvider } from "~/contexts/UIContext";
import { IdentityProvider, useOptionalIdentity } from "~/hooks/useIdentity";

const queryClient = new QueryClient();

function PendingJobSyncRunner() {
  usePendingJobSync();
  return null;
}

/** Keeps chatDb scoped to the active identity + listens for incoming DMs. */
function IdentitySync() {
  const { client } = useElisymClient();
  const idCtx = useOptionalIdentity();
  const pubkey = idCtx?.publicKey;
  const identity = idCtx?.identity;

  // Switch chatDb to active identity
  useEffect(() => {
    if (pubkey) {
      client.chatDb.setOwner(pubkey);
    }
  }, [client, pubkey]);

  // Profile cache for sender names/pictures
  const profileCache = useRef<Map<string, { name: string; picture?: string }>>(new Map());

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
        // Skip protocol messages
        try {
          const msg = JSON.parse(content);
          if (msg.type === "elisym_ping" || msg.type === "elisym_pong") return;
        } catch {
          // not JSON — regular text
        }

        const ts = createdAt * 1000; // Nostr seconds → ms

        void resolveProfile(senderPubkey).then((profile) => {
          client.chatDb.appendMessages(
            senderPubkey,
            profile.name,
            profile.picture,
            [
              {
                type: "system",
                id: rumorId,
                ts,
                text: content,
              },
            ],
          );
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
