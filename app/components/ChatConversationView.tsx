import { useEffect, useRef, useCallback, useState } from "react";
import {
  useChatHistory,
  usePersistChat,
  useHireAgent,
  useAgents,
} from "@elisym/sdk/react";
import { useElisymClient } from "@elisym/sdk/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { formatSol, truncateKey } from "@elisym/sdk";
import { nip19 } from "nostr-tools";
import { uploadToNostrBuild } from "~/lib/uploadImage";
import type { ChatMessage, Agent } from "@elisym/sdk";
import type { Filter } from "nostr-tools";
import { useUI } from "~/contexts/UIContext";
import { useIdentity } from "~/hooks/useIdentity";
import { useAgentDisplay } from "~/hooks/useAgentDisplay";
import { useLocalQuery } from "~/hooks/useLocalQuery";
import { MarbleAvatar } from "./MarbleAvatar";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatInputArea } from "./ChatInputArea";
import { ShowcaseView } from "./ShowcaseView";

interface ChatConversationViewProps {
  agentPubkey: string;
}

export function ChatConversationView({
  agentPubkey,
}: ChatConversationViewProps) {
  const [state, dispatch] = useUI();
  const { client } = useElisymClient();
  const { publicKey: myPubkey, identity: myIdentity } = useIdentity();
  const { publicKey, connect, select, wallets } = useWallet();
  const { data: rawAgents } = useAgents();
  const displayAgents = useAgentDisplay(rawAgents);
  const agent = displayAgents.find((a) => a.pubkey === agentPubkey);

  // Fetch kind:0 Nostr profile for the chat peer
  const { data: nostrProfile } = useLocalQuery<{ name?: string; picture?: string; about?: string } | null>({
    queryKey: ["nostr-profile", agentPubkey],
    queryFn: async () => {
      const events = await client.pool.querySync({
        kinds: [0],
        authors: [agentPubkey],
      } as Filter);
      const sorted = events.sort((a, b) => b.created_at - a.created_at);
      if (sorted[0]) {
        try { return JSON.parse(sorted[0].content); } catch {}
      }
      return null;
    },
    enabled: !!agentPubkey,
    staleTime: 1000 * 60 * 5,
  });

  const { messages: storedMessages, loaded } = useChatHistory(agentPubkey);
  const persistChat = usePersistChat();

  // Local messages state — starts from stored, appended locally
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const [hasPinged, setHasPinged] = useState(false);
  const [pingStatus, setPingStatus] = useState<"pinging" | "online" | "offline" | null>(null);

  const hire = useHireAgent();

  // Sync stored messages into local state — merge, don't replace
  // For self-chat, convert "system" messages to "user" so they show as sent bubbles
  useEffect(() => {
    if (!loaded || storedMessages.length === 0) return;
    const fixType = (m: ChatMessage): ChatMessage =>
      isSelf && m.type === "system" ? { ...m, type: "user" } : m;
    setLocalMessages((prev) => {
      if (prev.length === 0) return storedMessages.map(fixType).sort((a, b) => a.ts - b.ts);
      const existingIds = new Set(prev.map((m) => m.id));
      const newOnes = storedMessages.filter((m) => !existingIds.has(m.id)).map(fixType);
      if (newOnes.length === 0) return prev;
      return [...prev, ...newOnes].sort((a, b) => a.ts - b.ts);
    });
  }, [loaded, storedMessages]);

  // Scroll to bottom whenever content height changes (images loading, new messages, etc.)
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    const scroll = () => { container.scrollTop = container.scrollHeight; };
    scroll();

    const observer = new ResizeObserver(scroll);
    // Observe the scroll content — any child resize (e.g. image load) triggers scroll
    for (const child of container.children) {
      observer.observe(child);
    }
    observer.observe(container);

    return () => observer.disconnect();
  }, [localMessages]);

  const appendLocal = useCallback(
    (msgs: ChatMessage[]) => {
      setLocalMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const deduped = msgs.filter((m) => !existingIds.has(m.id));
        if (deduped.length === 0) return prev;
        const next = [...prev, ...deduped].sort((a, b) => a.ts - b.ts);
        persistChat(agentPubkey, agent?.name ?? "", agent?.picture, next, []);
        return next;
      });
    },
    [agentPubkey, agent, persistChat],
  );

  // Auto-ping on first open (skip self)
  const isSelf = agentPubkey === myPubkey;
  useEffect(() => {
    if (hasPinged || hire.step !== "idle" || isSelf) {
      return;
    }
    setHasPinged(true);
    setPingStatus("pinging");

    // hire.ping only uses agent.pubkey — pass minimal object to avoid waiting for agent list
    void hire.ping({ pubkey: agentPubkey } as Agent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPinged, isSelf]);

  // Update ping status when ping completes
  useEffect(() => {
    if (hire.step === "online" || hire.step === "offline") {
      setPingStatus(hire.step);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hire.step === "online", hire.step === "offline"]);

  // When result arrives
  useEffect(() => {
    if (hire.step === "success" && hire.result) {
      appendLocal([
        {
          type: "result",
          id: crypto.randomUUID(),
          ts: Date.now(),
          text: hire.result,
          eventId: hire.resultEventId,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hire.step === "success"]);

  // When error arrives
  useEffect(() => {
    if (hire.step === "error" && hire.error) {
      appendLocal([
        {
          type: "error",
          id: crypto.randomUUID(),
          ts: Date.now(),
          text: hire.error,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hire.step === "error"]);

  async function handleSend(text: string, file: File | null) {
    let msgText = text;

    // Upload file if attached
    if (file) {
      try {
        appendLocal([
          { type: "system", id: crypto.randomUUID(), ts: Date.now(), text: `Uploading ${file.name}...`, loading: true },
        ]);
        const fileUrl = await uploadToNostrBuild(file, myIdentity);
        msgText = msgText ? `${msgText}\n${fileUrl}` : fileUrl;
        // Remove uploading indicator
        setLocalMessages((prev) => prev.filter((m) => !m.loading));
      } catch (_err) {
        appendLocal([
          { type: "error", id: crypto.randomUUID(), ts: Date.now(), text: "File upload failed" },
        ]);
        return;
      }
    }

    if (!msgText) return;

    appendLocal([
      { type: "user", id: crypto.randomUUID(), ts: Date.now(), text: msgText },
    ]);

    // If agent is online, submit job
    if (hire.step === "online" && agent) {
      const capability = agent.tags[0] || "general";
      await hire.submitJob(msgText, capability, agent.agent, myIdentity);
    } else {
      // Send as NIP-17 DM
      try {
        void client.messaging.sendMessage(myIdentity, agentPubkey, msgText);
      } catch (_err) {
        // Best effort
      }
    }
  }

  async function handlePay() {
    if (!agent) {
      return;
    }

    if (!publicKey) {
      try {
        if (wallets.length > 0 && wallets[0]) {
          select(wallets[0].adapter.name);
        }
        await connect();
      } catch (_err) {
        appendLocal([
          {
            type: "error",
            id: crypto.randomUUID(),
            ts: Date.now(),
            text: "Wallet connection failed",
          },
        ]);
        return;
      }
    }

    await hire.pay(agent.agent);
  }

  const agentName = nostrProfile?.name || agent?.name || truncateKey(nip19.npubEncode(agentPubkey), 8);
  const agentPicture = nostrProfile?.picture || agent?.picture;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 h-14 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() =>
              dispatch({ type: "SET_ACTIVE_CONVERSATION", pubkey: null })
            }
            className="bg-transparent border-none text-text-2 text-lg cursor-pointer p-0 px-1 hover:text-text"
          >
            ←
          </button>
          <div className="w-9 h-9 rounded-full overflow-hidden">
            {agentPicture ? (
              <img
                src={agentPicture}
                alt={agentName}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <MarbleAvatar name={agentPubkey} size={36} />
            )}
          </div>
          <strong className="text-[15px]">{agentName}</strong>
          {pingStatus === "pinging" && (
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" title="Pinging..." />
          )}
          {pingStatus === "online" && (
            <span className="w-2 h-2 rounded-full bg-green-400" title="Online" />
          )}
          {pingStatus === "offline" && (
            <span className="w-2 h-2 rounded-full bg-red-400/60" title="Offline" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {agent && (
            <div className="flex bg-bg rounded-lg p-0.5 border border-border">
              {(["chat", "services"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => dispatch({ type: "SET_CONV_TAB", tab })}
                  className={`py-1 px-3 rounded-md border-none text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${
                    state.convTab === tab
                      ? "bg-accent text-white"
                      : "bg-transparent text-text-2 hover:text-text"
                  }`}
                >
                  {tab === "chat" ? "Chat" : "Services"}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => dispatch({ type: "CLOSE_CHAT" })}
            className="bg-transparent border-none text-text-2 text-xl cursor-pointer hover:text-text"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      {state.convTab === "services" && agent ? (
        <ShowcaseView agent={agent} />
      ) : (
        <>
          {/* Messages */}
          <div
            ref={messagesRef}
            className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-3"
          >
            {localMessages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                onPay={
                  msg.type === "payment" && !msg.paid
                    ? () => void handlePay()
                    : undefined
                }
              />
            ))}

            {/* Hire flow inline status */}
            {renderHireStatus(hire, () => void handlePay(), (positive: boolean) => void hire.sendFeedback(positive))}
          </div>

          {/* Input */}
          <ChatInputArea onSend={(text, file) => void handleSend(text, file)} />
        </>
      )}
    </div>
  );
}

function renderHireStatus(
  hire: ReturnType<typeof useHireAgent>,
  onPay: () => void,
  onFeedback: (positive: boolean) => void,
) {
  switch (hire.step) {
    case "pinging":
      return null;
    case "submitting":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start text-[13.5px] italic">
          Submitting job...
        </div>
      );
    case "payment-required": {
      const amt = hire.paymentAmount ? formatSol(hire.paymentAmount) : "N/A";
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start text-[13.5px]">
          Payment required: <strong>{amt}</strong>
          <br />
          <button
            onClick={onPay}
            className="mt-2 py-2 px-[22px] rounded-lg border-none bg-accent text-white text-[13px] font-semibold cursor-pointer"
          >
            Pay {amt}
          </button>
        </div>
      );
    }
    case "paying":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start text-[13.5px] italic">
          Processing payment...
        </div>
      );
    case "waiting-result":
      return (
        <div className="max-w-[80%] py-2.5 px-3.5 rounded-xl bg-surface-2 self-start text-[13.5px] italic">
          Waiting for result...
        </div>
      );
    case "success":
      return (
        <>
          {hire.feedbackState === "idle" && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onFeedback(true)}
                className="btn btn-outline py-1.5 px-4 text-xs"
              >
                Good
              </button>
              <button
                onClick={() => onFeedback(false)}
                className="btn btn-outline py-1.5 px-4 text-xs"
              >
                Bad
              </button>
            </div>
          )}
          {hire.feedbackState === "sent" && (
            <div className="text-xs text-text-2 mt-1">Feedback sent</div>
          )}
        </>
      );
    default:
      return null;
  }
}
