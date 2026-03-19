import { useUI } from "~/contexts/UIContext";
import type { AgentDisplayData } from "~/hooks/useAgentDisplay";

interface ShowcaseViewProps {
  agent: AgentDisplayData;
}

export function ShowcaseView({ agent }: ShowcaseViewProps) {
  const [, dispatch] = useUI();

  function handleSelect() {
    dispatch({
      type: "SET_SELECTED_SERVICE",
      service: {
        agentPubkey: agent.pubkey,
        name: agent.name,
        price: agent.price,
      },
    });
    dispatch({ type: "SET_CONV_TAB", tab: "chat" });
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden mb-2.5">
        <div className="p-3 px-3.5 pb-3.5">
          <div className="text-[15px] font-bold mb-0.5">{agent.name}</div>
          <div className="text-[12.5px] text-text-2 leading-relaxed mb-2.5">
            {agent.description}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-bold text-green">
              {agent.price}{" "}
              <span className="text-[11px] text-text-2 font-normal">
                per task
              </span>
            </div>
            <button
              onClick={handleSelect}
              className="py-1.5 px-3.5 rounded-[7px] border-none bg-accent text-white text-xs font-semibold cursor-pointer transition-all hover:bg-accent-hover"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
