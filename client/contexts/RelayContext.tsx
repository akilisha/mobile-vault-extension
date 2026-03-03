/**
 * Popup relay context: state from background (reducer + onMessage), sendCommand for actions.
 * QR data URL is derived in the popup; searchQuery and filteredRows are local.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import type { RelayEngineState, StatusKind } from "@/lib/relay-engine";
import type { A1Row } from "@/lib/vault-types";

const defaultEngineState: RelayEngineState = {
  relayUrl: "",
  status: { text: "", kind: "normal" },
  qrPayload: null,
  paired: false,
  rows: [],
  loading: "idle",
  form: {
    groupId: "",
    websiteUrl: "",
    description: "",
    attributes: [{ key: "", value: "" }],
  },
  connectDisabled: false,
  loadingRemove: null,
  editingId: null,
};

type RelayState = RelayEngineState & { searchQuery: string };
type RelayAction =
  | { type: "RELAY_STATE"; payload: Partial<RelayEngineState> }
  | { type: "SET_SEARCH_QUERY"; payload: string };

function relayReducer(state: RelayState, action: RelayAction): RelayState {
  switch (action.type) {
    case "RELAY_STATE":
      return { ...state, ...action.payload };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };
    default:
      return state;
  }
}

function sendCommand(
  type: string,
  payload?: Record<string, unknown>
): Promise<unknown> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

export interface RelayContextValue extends RelayEngineState {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  qrDataUrl: string | null;
  filteredRows: A1Row[];
  editingId: string | null;
  setRelayUrl: (url: string) => void;
  connect: () => void;
  disconnect: () => void;
  refreshVault: () => void;
  saveRow: () => void;
  removeRow: (groupId: string, key: string) => void;
  copyValue: (value: unknown) => void;
  clearClipboardOnClose: () => void;
  setForm: React.Dispatch<React.SetStateAction<RelayEngineState["form"]>>;
  setFormAttribute: (
    index: number,
    field: "key" | "value" | "isSecret",
    value: string | boolean
  ) => void;
  addFormAttribute: () => void;
  removeFormAttribute: (index: number) => void;
  setEditingId: (id: string | null) => void;
}

const RelayContext = createContext<RelayContextValue | null>(null);

export function RelayProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(relayReducer, {
    ...defaultEngineState,
    searchQuery: "",
  });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [hadCopiedSecret, setHadCopiedSecret] = useState(false);

  // Hydrate from background on mount
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    chrome.runtime.sendMessage({ type: "GET_RELAY_STATE" }, (response: RelayEngineState) => {
      if (response) dispatch({ type: "RELAY_STATE", payload: response });
    });
  }, []);

  // Subscribe to background state updates
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return;
    const listener = (message: { type?: string; payload?: RelayEngineState }) => {
      if (message.type === "RELAY_STATE" && message.payload) {
        dispatch({ type: "RELAY_STATE", payload: message.payload });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Derive QR data URL from qrPayload
  useEffect(() => {
    if (!state.qrPayload) {
      setQrDataUrl(null);
      return;
    }
    const str = JSON.stringify(state.qrPayload);
    QRCode.toDataURL(str, { width: 200, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [state.qrPayload]);

  const filteredRows = useMemo(() => {
    const q = state.searchQuery.trim().toLowerCase();
    if (!q) return state.rows;
    return state.rows.filter(
      (r) =>
        String(r.group).toLowerCase().includes(q) ||
        String(r.website).toLowerCase().includes(q) ||
        String(r.description).toLowerCase().includes(q) ||
        (r.attributes ?? []).some(
          (a) =>
            String(a.key).toLowerCase().includes(q) ||
            String(a.value).toLowerCase().includes(q)
        )
    );
  }, [state.rows, state.searchQuery]);

  const setSearchQuery = useCallback((q: string) => {
    dispatch({ type: "SET_SEARCH_QUERY", payload: q });
  }, []);

  const setRelayUrl = useCallback((url: string) => {
    sendCommand("RELAY_SET_RELAY_URL", { relayUrl: url });
  }, []);

  const connect = useCallback(() => {
    sendCommand("RELAY_CONNECT", { url: state.relayUrl });
  }, [state.relayUrl]);

  const disconnect = useCallback(() => {
    sendCommand("RELAY_DISCONNECT");
  }, []);

  const refreshVault = useCallback(() => {
    sendCommand("RELAY_REFRESH");
  }, []);

  const saveRow = useCallback(() => {
    sendCommand("RELAY_SAVE_ROW");
  }, []);

  const removeRow = useCallback((groupId: string, key: string) => {
    sendCommand("RELAY_REMOVE_ROW", { groupId, key });
  }, []);

  const copyValue = useCallback((value: unknown) => {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    navigator.clipboard.writeText(str).then(
      () => {
        setHadCopiedSecret(true);
        dispatch({
          type: "RELAY_STATE",
          payload: { status: { text: "Copied to clipboard", kind: "paired" as StatusKind } },
        });
      },
      () => {
        dispatch({
          type: "RELAY_STATE",
          payload: { status: { text: "Copy failed", kind: "error" as StatusKind } },
        });
      }
    );
  }, []);

  const clearClipboardOnClose = useCallback(() => {
    if (!hadCopiedSecret) return;
    setHadCopiedSecret(false);
    navigator.clipboard.writeText("").catch(() => {});
  }, [hadCopiedSecret]);

  const setForm = useCallback(
    (arg: React.SetStateAction<RelayEngineState["form"]>) => {
      const next = typeof arg === "function" ? arg(state.form) : arg;
      dispatch({ type: "RELAY_STATE", payload: { form: next } });
      sendCommand("RELAY_SET_FORM", { form: next });
    },
    [state.form]
  );

  const setFormAttribute = useCallback(
    (index: number, field: "key" | "value" | "isSecret", value: string | boolean) => {
      if (index < 0 || index >= state.form.attributes.length) return;
      const next = [...state.form.attributes];
      next[index] = { ...next[index], [field]: value };
      const form = { ...state.form, attributes: next };
      sendCommand("RELAY_SET_FORM", { form });
      dispatch({ type: "RELAY_STATE", payload: { form } });
    },
    [state.form]
  );

  const addFormAttribute = useCallback(() => {
    const form = {
      ...state.form,
      attributes: [...state.form.attributes, { key: "", value: "" }],
    };
    sendCommand("RELAY_SET_FORM", { form });
    dispatch({ type: "RELAY_STATE", payload: { form } });
  }, [state.form]);

  const removeFormAttribute = useCallback(
    (index: number) => {
      if (state.form.attributes.length <= 1) return;
      const next = state.form.attributes.filter((_, i) => i !== index);
      const form = { ...state.form, attributes: next };
      sendCommand("RELAY_SET_FORM", { form });
      dispatch({ type: "RELAY_STATE", payload: { form } });
    },
    [state.form]
  );

  const setEditingId = useCallback((id: string | null) => {
    sendCommand("RELAY_SET_EDITING_ID", { editingId: id });
    dispatch({ type: "RELAY_STATE", payload: { editingId: id } });
  }, []);

  const value = useMemo<RelayContextValue>(
    () => ({
      ...state,
      searchQuery: state.searchQuery,
      setSearchQuery,
      qrDataUrl,
      filteredRows,
      setRelayUrl,
      connect,
      disconnect,
      refreshVault,
      saveRow,
      removeRow,
      copyValue,
      clearClipboardOnClose,
      setForm,
      setFormAttribute,
      addFormAttribute,
      removeFormAttribute,
      setEditingId,
    }),
    [
      state,
      qrDataUrl,
      filteredRows,
      setSearchQuery,
      setRelayUrl,
      connect,
      disconnect,
      refreshVault,
      saveRow,
      removeRow,
      copyValue,
      clearClipboardOnClose,
      setForm,
      setFormAttribute,
      addFormAttribute,
      removeFormAttribute,
      setEditingId,
    ]
  );

  return <RelayContext.Provider value={value}>{children}</RelayContext.Provider>;
}

export function useRelay(): RelayContextValue {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error("useRelay must be used within RelayProvider");
  return ctx;
}
