import { formatSol } from "@elisym/sdk";
import type { ChatMessage } from "@elisym/sdk";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onPay?: () => void;
}

export function ChatMessageBubble({ message, onPay }: ChatMessageBubbleProps) {
  switch (message.type) {
    case "user":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-accent text-white self-end rounded-br-sm text-[13.5px] leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
      );

    case "system":
      return (
        <div
          className={`max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start rounded-bl-sm text-[13.5px] leading-relaxed ${
            message.loading ? "italic opacity-70" : ""
          }`}
        >
          {message.text}
        </div>
      );

    case "ping":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start rounded-bl-sm text-[13.5px] italic opacity-70">
          {message.online === null || message.online === undefined
            ? "Pinging agent..."
            : message.online
              ? "Agent is online"
              : "Agent is offline"}
        </div>
      );

    case "payment": {
      const amtStr = formatSol(message.amount);
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start rounded-bl-sm text-[13.5px] leading-relaxed">
          {message.paid
            ? `Payment of ${amtStr} confirmed`
            : `Payment required: ${amtStr}`}
          {!message.paid && onPay && (
            <button
              onClick={onPay}
              className="mt-2 py-2 px-[22px] rounded-lg border-none bg-accent text-white text-[13px] font-semibold cursor-pointer"
            >
              Pay {amtStr}
            </button>
          )}
        </div>
      );
    }

    case "result":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start rounded-bl-sm text-[13.5px] leading-relaxed whitespace-pre-wrap">
          <strong>Result:</strong>
          <br />
          {message.text}
        </div>
      );

    case "error":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start rounded-bl-sm text-[13.5px] leading-relaxed text-error">
          {message.text}
        </div>
      );

    default:
      return null;
  }
}
