import { formatSol } from "@elisym/sdk";
import type { CapabilityCard } from "@elisym/sdk";
import { useUI } from "~/contexts/UIContext";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";

interface ShowcaseViewProps {
  agent: AgentDisplayData;
}

export function ShowcaseView({ agent }: ShowcaseViewProps) {
  const [, dispatch] = useUI();

  function handleSelect(card: CapabilityCard) {
    const price = card.payment?.job_price;
    dispatch({
      type: "SET_SELECTED_SERVICE",
      service: {
        agentPubkey: agent.pubkey,
        name: card.name,
        price: price != null ? formatSol(price) : "N/A",
      },
    });
    dispatch({ type: "SET_CONV_TAB", tab: "chat" });
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      {agent.cards.map((card, i) => (
        <div
          key={i}
          className="bg-surface-2 border border-border rounded-xl overflow-hidden mb-2.5"
        >
          {card.image && (
            <img
              src={card.image}
              alt={card.name}
              className="w-full h-36 object-cover"
            />
          )}
          <div className="p-3 px-3.5 pb-3.5">
            <div className="text-[15px] font-bold mb-0.5">{card.name}</div>
            <div className="text-[12.5px] text-text-2 leading-relaxed mb-2">
              {card.description}
            </div>

            {card.capabilities.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2.5">
                {card.capabilities.map((tag) => (
                  <span
                    key={tag}
                    className="py-0.5 px-2 bg-tag-bg rounded-md text-[11px] text-text-2 border border-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-[15px] font-bold text-green">
                {card.payment?.job_price != null
                  ? formatSol(card.payment.job_price)
                  : "N/A"}{" "}
                <span className="text-[11px] text-text-2 font-normal">
                  per task
                </span>
              </div>
              <button
                onClick={() => handleSelect(card)}
                className="py-1.5 px-3.5 rounded-[7px] border-none bg-accent text-white text-xs font-semibold cursor-pointer transition-all hover:bg-accent-hover"
              >
                Select
              </button>
            </div>
          </div>
        </div>
      ))}

      {agent.cards.length === 0 && (
        <div className="text-center text-text-2 text-sm py-8">
          No products listed
        </div>
      )}
    </div>
  );
}
