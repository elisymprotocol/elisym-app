import { useUI } from "~/contexts/UIContext";

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

  return (
    <div className="flex items-center justify-between mb-7 gap-4 flex-wrap">
      <h2 className="text-xl font-bold whitespace-nowrap">
        Available Providers
      </h2>
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => dispatch({ type: "SET_FILTER", filter: f.key })}
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
