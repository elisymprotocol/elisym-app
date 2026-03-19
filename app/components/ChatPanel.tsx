import { useUI } from "~/contexts/UIContext";
import { ChatListView } from "./ChatListView";
import { ChatConversationView } from "./ChatConversationView";

export function ChatPanel() {
  const [state, dispatch] = useUI();

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

      {/* Panel */}
      <div className="fixed bottom-0 right-0 w-[420px] max-sm:w-screen h-screen bg-surface border-l border-border z-[400] flex flex-col">
        {state.activeConversation ? (
          <ChatConversationView agentPubkey={state.activeConversation} />
        ) : (
          <ChatListView />
        )}
      </div>
    </>
  );
}
