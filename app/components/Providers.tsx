import { useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { ElisymProvider } from "@elisym/sdk/react";
import { usePendingJobSync } from "@elisym/sdk/react";
import { UIProvider } from "~/contexts/UIContext";
import { IdentityProvider } from "~/hooks/useIdentity";

const queryClient = new QueryClient();

function PendingJobSyncRunner() {
  usePendingJobSync();
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
