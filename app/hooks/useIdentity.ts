import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { ElisymIdentity } from "@elisym/sdk";
import { nip19 } from "nostr-tools";
import { createElement } from "react";

const COMPAT_KEY = "elisym:identity";
const IDENTITIES_KEY = "elisym:identities";
const ACTIVE_KEY = "elisym:active-identity";

export interface StoredIdentity {
  id: string;
  hex: string;
  name: string;
  createdAt: number;
}

function toHex(sk: Uint8Array): string {
  return Array.from(sk)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readIdentities(): StoredIdentity[] {
  try {
    const raw = localStorage.getItem(IDENTITIES_KEY);
    if (raw) return JSON.parse(raw) as StoredIdentity[];
  } catch {}
  return [];
}

function writeIdentities(list: StoredIdentity[]) {
  localStorage.setItem(IDENTITIES_KEY, JSON.stringify(list));
}

function readActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function writeActiveId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

function writeCompat(hex: string) {
  localStorage.setItem(COMPAT_KEY, hex);
}

function migrate(): { list: StoredIdentity[]; activeId: string } {
  let list = readIdentities();
  let activeId = readActiveId();

  if (list.length === 0) {
    const legacyHex = localStorage.getItem(COMPAT_KEY);
    if (legacyHex) {
      const entry: StoredIdentity = {
        id: crypto.randomUUID(),
        hex: legacyHex,
        name: "Key 1",
        createdAt: Date.now(),
      };
      list = [entry];
      activeId = entry.id;
      writeIdentities(list);
      writeActiveId(activeId);
    } else {
      const fresh = ElisymIdentity.generate();
      const hex = toHex(fresh.secretKey);
      const entry: StoredIdentity = {
        id: crypto.randomUUID(),
        hex,
        name: "Key 1",
        createdAt: Date.now(),
      };
      list = [entry];
      activeId = entry.id;
      writeIdentities(list);
      writeActiveId(activeId);
      writeCompat(hex);
    }
  }

  if (!activeId || !list.find((e) => e.id === activeId)) {
    activeId = list[0]!.id;
    writeActiveId(activeId);
  }

  const active = list.find((e) => e.id === activeId)!;
  writeCompat(active.hex);

  return { list, activeId };
}

interface IdentityState {
  allIdentities: StoredIdentity[];
  activeId: string;
  identity: ElisymIdentity;
}

function init(): IdentityState | null {
  if (typeof window === "undefined") return null;
  const { list, activeId } = migrate();
  const active = list.find((e) => e.id === activeId)!;
  return {
    allIdentities: list,
    activeId,
    identity: ElisymIdentity.fromHex(active.hex),
  };
}

interface IdentityContextValue {
  identity: ElisymIdentity;
  npub: string;
  publicKey: string;
  nsecEncode: () => string;
  allIdentities: StoredIdentity[];
  activeId: string;
  addIdentity: () => void;
  switchIdentity: (id: string) => void;
  removeIdentity: (id: string) => void;
  renameIdentity: (id: string, name: string) => void;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<IdentityState | null>(init);

  // Hydrate on client if SSR returned null
  useEffect(() => {
    if (!state) setState(init());
  }, []);

  if (!state) {
    return createElement("div", null, children);
  }

  const { identity, allIdentities, activeId } = state;

  const nsecEncode = useCallback(
    () => nip19.nsecEncode(identity.secretKey),
    [identity],
  );

  const addIdentity = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const fresh = ElisymIdentity.generate();
      const hex = toHex(fresh.secretKey);
      const entry: StoredIdentity = {
        id: crypto.randomUUID(),
        hex,
        name: `Key ${prev.allIdentities.length + 1}`,
        createdAt: Date.now(),
      };
      const newList = [...prev.allIdentities, entry];
      writeIdentities(newList);
      writeActiveId(entry.id);
      writeCompat(hex);
      return { allIdentities: newList, activeId: entry.id, identity: fresh };
    });
  }, []);

  const switchIdentity = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const entry = prev.allIdentities.find((e) => e.id === id);
      if (!entry) return prev;
      writeActiveId(id);
      writeCompat(entry.hex);
      return {
        allIdentities: prev.allIdentities,
        activeId: id,
        identity: ElisymIdentity.fromHex(entry.hex),
      };
    });
  }, []);

  const removeIdentity = useCallback((id: string) => {
    setState((prev) => {
      if (!prev) return prev;
      if (prev.allIdentities.length <= 1) return prev;
      const newList = prev.allIdentities.filter((e) => e.id !== id);
      writeIdentities(newList);

      let newActiveId = prev.activeId;
      if (prev.activeId === id) {
        newActiveId = newList[0]!.id;
        writeActiveId(newActiveId);
        writeCompat(newList[0]!.hex);
      }

      return {
        allIdentities: newList,
        activeId: newActiveId,
        identity: ElisymIdentity.fromHex(
          newList.find((e) => e.id === newActiveId)!.hex,
        ),
      };
    });
  }, []);

  const renameIdentity = useCallback((id: string, name: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const newList = prev.allIdentities.map((e) =>
        e.id === id ? { ...e, name } : e,
      );
      writeIdentities(newList);
      return { ...prev, allIdentities: newList };
    });
  }, []);

  const value: IdentityContextValue = {
    identity,
    npub: identity.npub,
    publicKey: identity.publicKey,
    nsecEncode,
    allIdentities,
    activeId,
    addIdentity,
    switchIdentity,
    removeIdentity,
    renameIdentity,
  };

  return createElement(IdentityContext.Provider, { value }, children);
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    throw new Error("useIdentity must be used within <IdentityProvider>");
  }
  return ctx;
}
