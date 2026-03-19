import { useState, useCallback } from "react";
import { ElisymIdentity } from "@elisym/sdk";
import { nip19 } from "nostr-tools";

const IDENTITY_KEY = "elisym:identity";

function loadOrGenerate(): ElisymIdentity {
  const existing = ElisymIdentity.fromLocalStorage(IDENTITY_KEY);
  if (existing) {
    return existing;
  }
  const fresh = ElisymIdentity.generate();
  fresh.persist(IDENTITY_KEY);
  return fresh;
}

export function useIdentity() {
  const [identity, setIdentity] = useState(loadOrGenerate);

  const regenerate = useCallback(() => {
    const fresh = ElisymIdentity.generate();
    fresh.persist(IDENTITY_KEY);
    setIdentity(fresh);
    return fresh;
  }, []);

  const nsecEncode = useCallback(
    () => nip19.nsecEncode(identity.secretKey),
    [identity],
  );

  return {
    identity,
    npub: identity.npub,
    publicKey: identity.publicKey,
    nsecEncode,
    regenerate,
  };
}
