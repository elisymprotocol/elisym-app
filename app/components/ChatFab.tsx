import { useUI } from "~/contexts/UIContext";
import { useUnreadCounts } from "~/hooks/useUnreadCounts";

export function ChatFab() {
  const { totalUnread } = useUnreadCounts();
  const [, dispatch] = useUI();

  return (
    <button
      onClick={() => dispatch({ type: "TOGGLE_CHAT" })}
      className="fixed bottom-7 right-7 w-14 h-14 rounded-full bg-accent border-none text-white text-2xl cursor-pointer shadow-[0_4px_20px_rgba(26,26,46,0.3)] transition-all hover:scale-110 hover:shadow-[0_6px_28px_rgba(26,26,46,0.45)] z-[200]"
    >
      <span role="img" aria-label="chat">
        💬
      </span>
      {totalUnread > 0 && (
        <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-error text-white text-[11px] font-bold flex items-center justify-center">
          {totalUnread > 99 ? "99+" : totalUnread}
        </div>
      )}
    </button>
  );
}
