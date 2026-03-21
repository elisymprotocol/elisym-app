import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

interface UIState {
  currentFilter: string;
  wizardOpen: boolean;
  wizardStep: number;
  wizardData: Record<string, unknown>;
}

type UIAction =
  | { type: "SET_FILTER"; filter: string }
  | { type: "OPEN_WIZARD" }
  | { type: "CLOSE_WIZARD" }
  | { type: "SET_WIZARD_STEP"; step: number }
  | { type: "UPDATE_WIZARD_DATA"; data: Record<string, unknown> };

const initialState: UIState = {
  currentFilter: "all",
  wizardOpen: false,
  wizardStep: 1,
  wizardData: {
    name: "",
    desc: "",
    avatarFile: null,
    avatarPreview: null,
    products: [
      { name: "", desc: "", price: "", tags: [], photoFile: null, photoPreview: null },
    ],
  },
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "SET_FILTER":
      return { ...state, currentFilter: action.filter };
    case "OPEN_WIZARD":
      return { ...state, wizardOpen: true, wizardStep: 1 };
    case "CLOSE_WIZARD":
      return {
        ...state,
        wizardOpen: false,
        wizardStep: 1,
        wizardData: initialState.wizardData,
      };
    case "SET_WIZARD_STEP":
      return { ...state, wizardStep: action.step };
    case "UPDATE_WIZARD_DATA":
      return { ...state, wizardData: { ...state.wizardData, ...action.data } };
    default:
      return state;
  }
}

const UIContext = createContext<[UIState, Dispatch<UIAction>] | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const value = useReducer(uiReducer, initialState);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): [UIState, Dispatch<UIAction>] {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error("useUI must be used within UIProvider");
  }
  return ctx;
}
