import { toast } from "sonner";

/** Global map: agentPubkey → active loading toast ID */
const activeToasts = new Map<string, string | number>();

export function setJobToast(agentPubkey: string, toastId: string | number) {
  // Dismiss previous toast for this agent if any
  const prev = activeToasts.get(agentPubkey);
  if (prev) toast.dismiss(prev);
  activeToasts.set(agentPubkey, toastId);
}

export function resolveJobToast(agentPubkey: string, message: string) {
  const id = activeToasts.get(agentPubkey);
  if (id) {
    toast.success(message, { id });
    activeToasts.delete(agentPubkey);
  }
}

export function failJobToast(agentPubkey: string, message: string) {
  const id = activeToasts.get(agentPubkey);
  if (id) {
    toast.error(message, { id });
    activeToasts.delete(agentPubkey);
  }
}

export function dismissJobToast(agentPubkey: string) {
  const id = activeToasts.get(agentPubkey);
  if (id) {
    toast.dismiss(id);
    activeToasts.delete(agentPubkey);
  }
}

export function hasJobToast(agentPubkey: string): boolean {
  return activeToasts.has(agentPubkey);
}
