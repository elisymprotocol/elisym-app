import { useUI } from "~/contexts/UIContext";
import { useAgents } from "~/hooks/useAgents";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const { dataUpdatedAt } = useAgents();
  const queryClient = useQueryClient();
  const synced = !!dataUpdatedAt;
  const [resyncing, setResyncing] = useState(false);

  async function handleResync() {
    if (resyncing) return;
    setResyncing(true);
    track("resync");
    try {
      await queryClient.refetchQueries({ queryKey: ["agents"] });
    } finally {
      setResyncing(false);
    }
  }

  return (
    <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
      <h2 className="text-xl font-bold whitespace-nowrap flex items-center gap-2.5">
        Available Providers
        <button
          onClick={handleResync}
          disabled={resyncing}
          className="size-4 flex items-center justify-center bg-transparent border-none cursor-pointer p-0"
          title="Resync"
        >
          <span
            className={`size-2 rounded-full transition-colors duration-700 ${
              resyncing || !synced ? "bg-yellow-400 animate-pulse" : "bg-green"
            }`}
          />
        </button>
      </h2>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { track("filter", { category: f.key }); dispatch({ type: "SET_FILTER", filter: f.key }); }}
            className={`py-2 px-4 rounded-full border text-xs font-medium cursor-pointer transition-all ${
              state.currentFilter === f.key
                ? "bg-accent border-accent text-white"
                : "bg-transparent border-border text-text-2 hover:border-accent hover:text-text"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
