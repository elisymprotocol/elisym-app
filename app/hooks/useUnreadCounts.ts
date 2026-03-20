import { useState, useEffect, useCallback, useMemo } from "react";
import { useAllConversations } from "@elisym/sdk/react";
import { useOptionalIdentity } from "./useIdentity";

const STORAGE_KEY_PREFIX = "elisym-lastRead";

function storageKey(ownerPubkey: string): string {
  return `${STORAGE_KEY_PREFIX}-${ownerPubkey}`;
}

function loadLastRead(ownerPubkey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(ownerPubkey));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLastRead(ownerPubkey: string, data: Record<string, number>): void {
  localStorage.setItem(storageKey(ownerPubkey), JSON.stringify(data));
}

export function useUnreadCounts() {
  const idCtx = useOptionalIdentity();
  const ownerPubkey = idCtx?.publicKey ?? "default";
  const { conversations } = useAllConversations();
  const [lastRead, setLastRead] = useState<Record<string, number>>(() =>
    loadLastRead(ownerPubkey),
  );

  // Reload when identity changes
  useEffect(() => {
    setLastRead(loadLastRead(ownerPubkey));
  }, [ownerPubkey]);

  const markRead = useCallback(
    (agentPubkey: string) => {
      setLastRead((prev) => {
        const next = { ...prev, [agentPubkey]: Date.now() };
        saveLastRead(ownerPubkey, next);
        return next;
      });
    },
    [ownerPubkey],
  );

  /** Map of agentPubkey → unread count (incoming messages after lastReadTs) */
  const unreadByPubkey = useMemo(() => {
    const incomingTypes = new Set(["system", "result"]);
    const map: Record<string, number> = {};
    for (const convo of conversations) {
      const readTs = lastRead[convo.agentPubkey] ?? 0;
      const count = convo.messages.filter(
        (m) => incomingTypes.has(m.type) && m.ts > readTs,
      ).length;
      if (count > 0) map[convo.agentPubkey] = count;
    }
    return map;
  }, [conversations, lastRead]);

  const totalUnread = useMemo(
    () => Object.values(unreadByPubkey).reduce((sum, n) => sum + n, 0),
    [unreadByPubkey],
  );

  return { unreadByPubkey, totalUnread, markRead };
}
