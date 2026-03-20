import { useUI } from "~/contexts/UIContext";
import { useOptionalIdentity } from "~/hooks/useIdentity";
import { ChatListView } from "./ChatListView";
import { ChatConversationView } from "./ChatConversationView";

export function ChatPanel() {
  const [state, dispatch] = useUI();
  const identity = useOptionalIdentity();
  const activeId = identity?.activeId ?? "default";

  if (!state.chatOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/25 z-[300]"
        onClick={() => dispatch({ type: "CLOSE_CHAT" })}
      />

      {/* Panel — key resets chat state when identity changes */}
      <div key={activeId} className="fixed bottom-0 right-0 w-[520px] max-sm:w-screen h-screen bg-surface border-l border-border z-[400] flex flex-col">
        {state.activeConversation ? (
          <ChatConversationView agentPubkey={state.activeConversation} />
        ) : (
          <ChatListView />
        )}
      </div>
    </>
  );
}
