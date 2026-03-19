import { useState, useRef } from "react";
import { useUI } from "~/contexts/UIContext";

interface ChatInputAreaProps {
  onSend: (text: string, file: File | null) => void;
}

export function ChatInputArea({ onSend }: ChatInputAreaProps) {
  const [text, setText] = useState("");
  const [state, dispatch] = useUI();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const hasContent = text.trim() || state.selectedService || state.attachedFile;
    if (!hasContent) {
      return;
    }

    let msgText = text.trim();
    if (state.selectedService) {
      const prefix = `${state.selectedService.name} · ${state.selectedService.price}`;
      msgText = msgText ? `${prefix}\n${msgText}` : prefix;
      dispatch({ type: "SET_SELECTED_SERVICE", service: null });
    }

    if (state.attachedFile) {
      const filePrefix = `[File: ${state.attachedFile.name}]`;
      msgText = msgText ? `${filePrefix}\n${msgText}` : filePrefix;
    }

    onSend(msgText, state.attachedFile);
    setText("");
    dispatch({ type: "SET_ATTACHED_FILE", file: null });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      dispatch({ type: "SET_ATTACHED_FILE", file });
    }
    e.target.value = "";
  }

  return (
    <div className="py-2.5 px-3.5 border-t border-border">
      <div
        className="flex flex-col p-1.5 px-2 rounded-[10px] border border-border bg-surface-2 cursor-text transition-colors focus-within:border-accent"
        onClick={() =>
          (
            document.querySelector(".chat-text-input") as HTMLInputElement
          )?.focus()
        }
      >
        {/* Selected service tag */}
        {state.selectedService && (
          <div className="inline-flex items-center self-start gap-1 bg-accent text-white rounded-md py-0.5 px-2 text-[11.5px] whitespace-nowrap mb-1">
            <span className="font-medium">
              {state.selectedService.name} · {state.selectedService.price}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "SET_SELECTED_SERVICE", service: null });
              }}
              className="bg-transparent border-none text-white/70 cursor-pointer text-[11px] p-0 leading-none hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Attached file preview */}
        {state.attachedFile && (
          <div className="flex items-center gap-2 bg-bg border border-border rounded-lg py-1.5 px-2.5 mb-1">
            <div className="w-9 h-9 rounded-md bg-surface-2 overflow-hidden flex items-center justify-center shrink-0">
              {state.attachedFile.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(state.attachedFile)}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[11px] font-semibold text-text-2 uppercase">
                  {state.attachedFile.name.split(".").pop()}
                </span>
              )}
            </div>
            <span className="flex-1 text-xs text-text truncate">
              {state.attachedFile.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: "SET_ATTACHED_FILE", file: null });
              }}
              className="bg-transparent border-none text-text-2 cursor-pointer text-[11px] hover:text-text"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="bg-transparent border-none text-text-2 cursor-pointer p-0.5 flex items-center shrink-0 transition-colors hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt,.csv,.json,.zip"
            onChange={handleFileChange}
          />
          <input
            className="chat-text-input flex-1 min-w-0 py-1.5 px-2 rounded-none border-none bg-transparent text-text text-[13.5px] outline-none"
            placeholder="Write your message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSend();
              }
            }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSend();
            }}
            className="py-1 px-3 rounded-md border-none bg-accent text-white text-xs font-semibold cursor-pointer shrink-0 hover:bg-accent-hover"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
