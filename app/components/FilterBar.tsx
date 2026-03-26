import { useUI } from "~/contexts/UIContext";
import { useAgents } from "~/hooks/useAgents";
import { useAgentFeedback } from "~/hooks/useAgentFeedback";
import { useQueryClient } from "@tanstack/react-query";
import { track } from "~/lib/analytics";

export const KNOWN_CATEGORIES = ["ui-ux", "summary", "tools", "code", "data"];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "ui-ux", label: "UI/UX" },
  { key: "summary", label: "Summary" },
  { key: "tools", label: "Tools" },
  { key: "code", label: "Code" },
  { key: "data", label: "Data" },
  { key: "other", label: "Other" },
];

export function FilterBar() {
  const [state, dispatch] = useUI();
  const { dataUpdatedAt, isFetching: agentsFetching } = useAgents();
  const { isFetching: feedbackFetching } = useAgentFeedback();
  const queryClient = useQueryClient();
  const synced = !!dataUpdatedAt;
  const isFetching = agentsFetching || feedbackFetching;

  function handleResync() {
    track("resync");
    queryClient.refetchQueries({ queryKey: ["agents"] });
    queryClient.refetchQueries({ queryKey: ["agent-feedback"] });
  }

  return (
    <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
      <h2 className="text-xl font-bold whitespace-nowrap flex items-center gap-2.5">
        Available Providers
        <button
          onClick={handleResync}
          className="size-4 flex items-center justify-center bg-transparent border-none cursor-pointer p-0"
          title="Resync"
        >
          <span
            className={`size-2 rounded-full transition-colors duration-700 ${
              isFetching || !synced ? "bg-[#f0d68a] animate-pulse" : "bg-[#7dd4a3]"
            }`}
          />
        </button>
      </h2>
      <div className="flex gap-1 p-1 rounded-xl bg-[#f5f4f2] overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { track("filter", { category: f.key }); dispatch({ type: "SET_FILTER", filter: f.key }); }}
            className={`py-1.5 px-3.5 rounded-lg text-xs font-medium cursor-pointer transition-all border-none shrink-0 whitespace-nowrap ${
              state.currentFilter === f.key
                ? "bg-white text-text shadow-sm"
                : "bg-transparent text-text-2 hover:text-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
