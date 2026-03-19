import { finalizeEvent } from "nostr-tools";
import type { ElisymIdentity } from "@elisym/sdk";

const UPLOAD_URL = "https://nostr.build/api/v2/upload/files";

/**
 * Upload a file to nostr.build with NIP-98 authentication.
 * Creates a kind:27235 auth event signed by the provider's identity.
 */
export async function uploadToNostrBuild(
  file: File,
  identity: ElisymIdentity,
): Promise<string> {
  // Build NIP-98 auth event (kind 27235)
  const authEvent = finalizeEvent(
    {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["u", UPLOAD_URL],
        ["method", "POST"],
      ],
      content: "",
    },
    identity.secretKey,
  );

  const authHeader =
    "Nostr " + btoa(JSON.stringify(authEvent));

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const url = data?.data?.[0]?.url;
  if (!url) {
    throw new Error("No URL returned from upload");
  }
  return url;
}
