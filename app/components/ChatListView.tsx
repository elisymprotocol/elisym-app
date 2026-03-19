import { useAllConversations } from "@elisym/sdk/react";
import { truncateKey } from "@elisym/sdk";
import { nip19 } from "nostr-tools";
import { useUI } from "~/contexts/UIContext";
import { MarbleAvatar } from "./MarbleAvatar";

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function ChatListView() {
  const { conversations } = useAllConversations();
  const [state, dispatch] = useUI();

  return (
    <>
      {/* Header */}
      <div className="px-5 h-14 border-b border-border flex items-center justify-between shrink-0">
        <strong className="text-base">Chats</strong>
        <button
          onClick={() => dispatch({ type: "CLOSE_CHAT" })}
          className="bg-transparent border-none text-text-2 text-xl cursor-pointer hover:text-text"
        >
          ✕
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {conversations.length === 0 ? (
          <p className="text-text-2 text-center py-10">
            No chats yet.
          </p>
        ) : (
          conversations.map((c) => {
            const npub = nip19.npubEncode(c.agentPubkey);
            const displayName = c.agentName || truncateKey(npub, 8);
            const lastMsg =
              c.messages.length > 0
                ? c.messages[c.messages.length - 1]
                : null;
            const lastText = lastMsg
              ? ("text" in lastMsg ? lastMsg.text : lastMsg.type)
              : "New conversation";
            const lastTs = lastMsg?.ts ?? c.updatedAt;

            return (
              <div
                key={c.agentPubkey}
                onClick={() =>
                  dispatch({
                    type: "SET_ACTIVE_CONVERSATION",
                    pubkey: c.agentPubkey,
                  })
                }
                className="flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-colors hover:bg-surface-2"
              >
                <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden">
                  {c.agentPicture ? (
                    <img
                      src={c.agentPicture}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MarbleAvatar name={c.agentPubkey} size={40} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <span className="text-[11px] text-text-2 shrink-0 ml-2">
                      {formatDate(lastTs)}
                    </span>
                  </div>
                  <div className="text-xs text-text-2 mt-0.5 truncate">
                    {lastText?.slice(0, 50)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
