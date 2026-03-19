import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

interface UIState {
  chatOpen: boolean;
  chatTab: "customer" | "provider";
  activeConversation: string | null;
  convTab: "chat" | "services";
  currentFilter: string;
  wizardOpen: boolean;
  wizardStep: number;
  wizardData: Record<string, unknown>;
  selectedService: { agentPubkey: string; name: string; price: string } | null;
  attachedFile: File | null;
}

type UIAction =
  | { type: "TOGGLE_CHAT" }
  | { type: "OPEN_CHAT" }
  | { type: "CLOSE_CHAT" }
  | { type: "SET_CHAT_TAB"; tab: "customer" | "provider" }
  | { type: "SET_ACTIVE_CONVERSATION"; pubkey: string | null }
  | { type: "SET_CONV_TAB"; tab: "chat" | "services" }
  | { type: "SET_FILTER"; filter: string }
  | { type: "OPEN_WIZARD" }
  | { type: "CLOSE_WIZARD" }
  | { type: "SET_WIZARD_STEP"; step: number }
  | { type: "UPDATE_WIZARD_DATA"; data: Record<string, unknown> }
  | {
      type: "SET_SELECTED_SERVICE";
      service: { agentPubkey: string; name: string; price: string } | null;
    }
  | { type: "SET_ATTACHED_FILE"; file: File | null };

const initialState: UIState = {
  chatOpen: false,
  chatTab: "customer",
  activeConversation: null,
  convTab: "chat",
  currentFilter: "all",
  wizardOpen: false,
  wizardStep: 1,
  wizardData: {
    type: "human",
    name: "",
    desc: "",
    avatar: null,
    tags: [],
    wallet: null,
    walletAddress: null,
    pricingMode: "single",
    generalPrice: "",
    products: [{ name: "", desc: "", price: "", photo: null }],
  },
  selectedService: null,
  attachedFile: null,
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "TOGGLE_CHAT":
      return { ...state, chatOpen: !state.chatOpen };
    case "OPEN_CHAT":
      return { ...state, chatOpen: true };
    case "CLOSE_CHAT":
      return {
        ...state,
        chatOpen: false,
        activeConversation: null,
        selectedService: null,
        attachedFile: null,
      };
    case "SET_CHAT_TAB":
      return { ...state, chatTab: action.tab };
    case "SET_ACTIVE_CONVERSATION":
      return { ...state, activeConversation: action.pubkey, convTab: "chat" };
    case "SET_CONV_TAB":
      return { ...state, convTab: action.tab };
    case "SET_FILTER":
      return { ...state, currentFilter: action.filter };
    case "OPEN_WIZARD":
      return { ...state, wizardOpen: true, wizardStep: 1 };
    case "CLOSE_WIZARD":
      return { ...state, wizardOpen: false };
    case "SET_WIZARD_STEP":
      return { ...state, wizardStep: action.step };
    case "UPDATE_WIZARD_DATA":
      return { ...state, wizardData: { ...state.wizardData, ...action.data } };
    case "SET_SELECTED_SERVICE":
      return { ...state, selectedService: action.service };
    case "SET_ATTACHED_FILE":
      return { ...state, attachedFile: action.file };
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
