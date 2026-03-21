import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { ElisymClient, type ElisymClientConfig } from "@elisym/sdk";

interface ElisymClientContextValue {
  client: ElisymClient;
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

  useEffect(() => () => client.close(), [client]);

  return (
    <ElisymClientContext.Provider value={{ client }}>
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
