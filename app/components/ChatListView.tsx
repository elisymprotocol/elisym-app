import { useAllConversations } from "@elisym/sdk/react";
import { useUI } from "~/contexts/UIContext";
import { MarbleAvatar } from "./MarbleAvatar";

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

      {/* Tabs */}
      <div className="flex mx-4 my-3 p-[3px] bg-surface-2 rounded-[10px] border border-border shrink-0">
        {(["customer", "provider"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => dispatch({ type: "SET_CHAT_TAB", tab })}
            className={`flex-1 py-2 px-3 text-[13px] font-medium rounded-lg border-none cursor-pointer text-center transition-all ${
              state.chatTab === tab
                ? "text-text bg-surface font-semibold shadow-sm"
                : "text-text-2 bg-transparent hover:text-text"
            }`}
          >
            {tab === "customer" ? "My Orders" : "My Services"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {state.chatTab === "customer" ? (
          conversations.length === 0 ? (
            <p className="text-text-2 text-center py-10">
              No orders yet.
              <br />
              Hire an agent to start.
            </p>
          ) : (
            conversations.map((c) => {
              const lastMsg =
                c.messages.length > 0
                  ? c.messages[c.messages.length - 1]
                  : null;
              const lastText = lastMsg
                ? ("text" in lastMsg ? lastMsg.text : lastMsg.type)
                : "New conversation";

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
                        alt={c.agentName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MarbleAvatar name={c.agentName} size={40} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{c.agentName}</div>
                    <div className="text-xs text-text-2 mt-0.5 truncate">
                      {lastText?.slice(0, 50)}
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          <p className="text-text-2 text-center py-10">
            No service requests yet.
          </p>
        )}
      </div>
    </>
  );
}
