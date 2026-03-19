import { useAllConversations } from "@elisym/sdk/react";
import { useUI } from "~/contexts/UIContext";

export function ChatFab() {
  const { conversations } = useAllConversations();
  const [, dispatch] = useUI();
  const count = conversations.length;

  return (
    <button
      onClick={() => dispatch({ type: "TOGGLE_CHAT" })}
      className="fixed bottom-7 right-7 w-14 h-14 rounded-full bg-accent border-none text-white text-2xl cursor-pointer shadow-[0_4px_20px_rgba(26,26,46,0.3)] transition-all hover:scale-110 hover:shadow-[0_6px_28px_rgba(26,26,46,0.45)] z-[200]"
    >
      <span role="img" aria-label="chat">
        💬
      </span>
      {count > 0 && (
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-error text-white text-[11px] font-bold flex items-center justify-center">
          {count}
        </div>
      )}
    </button>
  );
}
