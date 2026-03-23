import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { ElisymClient, type ElisymClientConfig } from "@elisym/sdk";

interface ElisymClientContextValue {
  client: ElisymClient;
  relaysConnected: boolean;
  resetPool: () => void;
}

const ElisymClientContext = createContext<ElisymClientContextValue | null>(null);

export function ElisymProvider({
  config,
  children,
}: {
  config?: ElisymClientConfig;
  children: ReactNode;
}) {
  const client = useMemo(() => new ElisymClient(config), []);
  const [relaysConnected, setRelaysConnected] = useState(false);

  const resetPool = useCallback(() => {
    client.pool.reset();
  }, [client]);

  useEffect(() => {
    client.pool.querySync({ kinds: [0], limit: 1 }).then(() => {
      setRelaysConnected(true);
    });
    return () => client.close();
  }, [client]);

  // Recover pool when tab returns to foreground
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        client.pool.probe(3_000).catch(() => {
          console.log("[ElisymProvider] probe failed, resetting pool");
          client.pool.reset();
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [client]);

  return (
    <ElisymClientContext.Provider value={{ client, relaysConnected, resetPool }}>
      {children}
    </ElisymClientContext.Provider>
  );
}

export function useElisymClient() {
  const ctx = useContext(ElisymClientContext);
  if (!ctx)
    throw new Error("useElisymClient must be used within ElisymProvider");
  return ctx;
}
