import { useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { ElisymProvider } from "~/hooks/useElisymClient";
import { UIProvider } from "~/contexts/UIContext";
import { IdentityProvider } from "~/hooks/useIdentity";
import { useHeartbeat } from "~/hooks/useHeartbeat";

const queryClient = new QueryClient();

function Heartbeat({ children }: { children: ReactNode }) {
  useHeartbeat();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ], []);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ElisymProvider config={{ network: "devnet" }}>
              <IdentityProvider>
                <Heartbeat>
                  <UIProvider>
                    {children}
                  </UIProvider>
                </Heartbeat>
              </IdentityProvider>
            </ElisymProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
