import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ElisymClient, type ElisymClientConfig } from "@elisym/sdk";

interface ElisymClientContextValue {
  client: ElisymClient;
  relaysConnected: boolean;
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

  useEffect(() => {
    client.pool.querySync({ kinds: [0], limit: 1 }).then(() => {
      setRelaysConnected(true);
    });
    return () => client.close();
  }, [client]);

  return (
    <ElisymClientContext.Provider value={{ client, relaysConnected }}>
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
