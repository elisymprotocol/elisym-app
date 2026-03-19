import { formatSol } from "@elisym/sdk";
import type { ChatMessage } from "@elisym/sdk";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  onPay?: () => void;
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Timestamp({ ts, align }: { ts: number; align: "left" | "right" }) {
  if (!ts) return null;
  return (
    <div
      className={`text-[10px] text-text-2 mt-0.5 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {formatTime(ts)}
    </div>
  );
}

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
const AUDIO_RE = /\.(mp3|wav|ogg|m4a|flac|aac|opus)(\?.*)?$/i;
const VIDEO_RE = /\.(mp4|webm|mov|avi)(\?.*)?$/i;
const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
const URL_TEST = /^https?:\/\//;

function fileName(url: string): string {
  try {
    const path = new URL(url).pathname;
    return path.split("/").pop() || "file";
  } catch {
    return "file";
  }
}

/** Render text with inline images, audio, video, and clickable links. */
function RichText({ text }: { text: string }) {
  const parts = text.split(URL_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (!URL_TEST.test(part)) return part;
        if (IMAGE_RE.test(part)) {
          return (
            <div key={i} className="mt-1">
              <a href={part} target="_blank" rel="noopener noreferrer">
                <img
                  src={part}
                  alt=""
                  className="max-w-full rounded-lg max-h-[240px] object-contain"
                  loading="lazy"
                />
              </a>
              <a href={part} target="_blank" rel="noopener noreferrer" className="text-[11px] opacity-60 break-all hover:opacity-100">
                {part}
              </a>
            </div>
          );
        }
        if (AUDIO_RE.test(part)) {
          return (
            <div key={i} className="mt-1">
              <audio controls preload="metadata" className="max-w-full h-10">
                <source src={part} />
              </audio>
              <a href={part} target="_blank" rel="noopener noreferrer" className="text-[11px] opacity-60 break-all hover:opacity-100">
                {part}
              </a>
            </div>
          );
        }
        if (VIDEO_RE.test(part)) {
          return (
            <div key={i} className="mt-1">
              <video
                controls
                preload="metadata"
                className="max-w-full rounded-lg max-h-[240px]"
              >
                <source src={part} />
              </video>
              <a href={part} target="_blank" rel="noopener noreferrer" className="text-[11px] opacity-60 break-all hover:opacity-100">
                {part}
              </a>
            </div>
          );
        }
        // Other files — show as download link with file icon
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mt-1 py-1.5 px-2.5 rounded-lg bg-bg/50 border border-border no-underline text-inherit hover:bg-bg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-xs truncate">{fileName(part)}</span>
          </a>
        );
      })}
    </>
  );
}

export function ChatMessageBubble({ message, onPay }: ChatMessageBubbleProps) {
  switch (message.type) {
    case "user":
      return (
        <div className="max-w-[80%] self-end">
          <div className="py-2.5 px-3.5 rounded-xl bg-accent text-white rounded-br-sm text-[13.5px] leading-relaxed whitespace-pre-wrap">
            <RichText text={message.text} />
          </div>
          <Timestamp ts={message.ts} align="right" />
        </div>
      );

    case "system":
      return (
        <div className="max-w-[80%] self-start">
          <div
            className={`py-2.5 px-3.5 rounded-xl bg-surface-2 rounded-bl-sm text-[13.5px] leading-relaxed whitespace-pre-wrap ${
              message.loading ? "italic opacity-70" : ""
            }`}
          >
            {message.loading ? message.text : <RichText text={message.text} />}
          </div>
          {!message.loading && <Timestamp ts={message.ts} align="left" />}
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
        <div className="max-w-[80%] self-start">
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-2 rounded-bl-sm text-[13.5px] leading-relaxed">
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
          <Timestamp ts={message.ts} align="left" />
        </div>
      );
    }

    case "result":
      return (
        <div className="max-w-[80%] self-start">
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-2 rounded-bl-sm text-[13.5px] leading-relaxed whitespace-pre-wrap">
            <strong>Result:</strong>
            <br />
            <RichText text={message.text} />
          </div>
          <Timestamp ts={message.ts} align="left" />
        </div>
      );

    case "error":
      return (
        <div className="max-w-[80%] self-start">
          <div className="py-2.5 px-3.5 rounded-xl bg-surface-2 rounded-bl-sm text-[13.5px] leading-relaxed text-error">
            {message.text}
          </div>
          <Timestamp ts={message.ts} align="left" />
        </div>
      );

    default:
      return null;
  }
}
