import { useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { ElisymProvider } from "~/hooks/useElisymClient";
import { UIProvider } from "~/contexts/UIContext";
import { IdentityProvider } from "~/hooks/useIdentity";

const queryClient = new QueryClient();

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
                {children}
              </UIProvider>
            </IdentityProvider>
          </ElisymProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
