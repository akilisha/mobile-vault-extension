/**
 * Extension popup state machine: action-aware.
 * States, actions, transitions (state × action → next state), and effects.
 * Popup dispatches actions; reducer returns next state and effects; caller runs effects.
 */

export type ExtensionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED_CAPTURE_OFF"
  | "CONNECTED_CAPTURE_ON";

export interface ExtensionStateInputs {
  paired: boolean;
  captureActive: boolean;
  hasQrPayload: boolean;
}

/** Actions that drive the machine. Every transition is triggered by one of these. */
export type ExtensionAction =
  | { type: "RELAY_STATUS"; payload: { paired: boolean; hasQrPayload: boolean } }
  | { type: "CAPTURE_ACTIVATE"; payload: { tabId: number } }
  | { type: "CAPTURE_DEACTIVATE" }
  | { type: "CAPTURE_STATE_SYNC"; payload: { captureActive: boolean } };

/** Effects the caller must perform when the machine says so. */
export type ExtensionEffect =
  | { type: "CLEAR_CAPTURE_IN_BACKGROUND" }
  | { type: "SEND_CAPTURE_ACTIVATE"; tabId: number }
  | { type: "SEND_CAPTURE_DEACTIVATE" };

export interface ExtensionStateResult {
  state: ExtensionState;
  showConnectView: boolean;
  connectStage: "disconnected" | "connecting";
  captureActiveForUI: boolean;
  clearCaptureInBackground: boolean;
}

/**
 * Reducer: (inputs, action) → { inputs, effects }.
 * Action-aware: every transition is explicit; effects are returned for the caller to run.
 */
export function extensionReducer(
  inputs: ExtensionStateInputs,
  action: ExtensionAction
): { inputs: ExtensionStateInputs; effects: ExtensionEffect[] } {
  const effects: ExtensionEffect[] = [];
  let nextInputs: ExtensionStateInputs = { ...inputs };

  switch (action.type) {
    case "RELAY_STATUS": {
      const { paired, hasQrPayload } = action.payload;
      nextInputs = {
        paired,
        hasQrPayload,
        captureActive: paired ? inputs.captureActive : false,
      };
      const nextState = getStateFromInputs(nextInputs);
      if (nextState === "DISCONNECTED" || nextState === "CONNECTING") {
        effects.push({ type: "CLEAR_CAPTURE_IN_BACKGROUND" });
      }
      return { inputs: nextInputs, effects };
    }
    case "CAPTURE_ACTIVATE": {
      const state = getStateFromInputs(inputs);
      if (state !== "CONNECTED_CAPTURE_OFF" && state !== "CONNECTED_CAPTURE_ON") {
        return { inputs, effects };
      }
      nextInputs = { ...inputs, captureActive: true };
      effects.push({ type: "SEND_CAPTURE_ACTIVATE", tabId: action.payload.tabId });
      return { inputs: nextInputs, effects };
    }
    case "CAPTURE_DEACTIVATE": {
      nextInputs = { ...inputs, captureActive: false };
      effects.push({ type: "SEND_CAPTURE_DEACTIVATE" });
      return { inputs: nextInputs, effects };
    }
    case "CAPTURE_STATE_SYNC": {
      nextInputs = { ...inputs, captureActive: action.payload.captureActive };
      const nextState = getStateFromInputs(nextInputs);
      if (nextState === "DISCONNECTED" || nextState === "CONNECTING") {
        effects.push({ type: "CLEAR_CAPTURE_IN_BACKGROUND" });
      }
      return { inputs: nextInputs, effects };
    }
    default:
      return { inputs, effects };
  }
}

function getStateFromInputs(inputs: ExtensionStateInputs): ExtensionState {
  const { paired, captureActive, hasQrPayload } = inputs;
  if (!paired) return hasQrPayload ? "CONNECTING" : "DISCONNECTED";
  return captureActive ? "CONNECTED_CAPTURE_ON" : "CONNECTED_CAPTURE_OFF";
}

/**
 * Derive UI and side-effect flags from current inputs (for rendering).
 * Use this when you have inputs and need showConnectView, captureActiveForUI, etc.
 */
export function getExtensionState(inputs: ExtensionStateInputs): ExtensionStateResult {
  const state = getStateFromInputs(inputs);
  const clearCaptureInBackground = state === "DISCONNECTED" || state === "CONNECTING";
  return {
    state,
    showConnectView: state === "DISCONNECTED" || state === "CONNECTING",
    connectStage: state === "CONNECTING" ? "connecting" : "disconnected",
    captureActiveForUI: state === "CONNECTED_CAPTURE_ON",
    clearCaptureInBackground,
  };
}

/**
 * Run effects (send messages to background). Call this with the effects returned by the reducer.
 */
export function runExtensionEffects(effects: ExtensionEffect[]): void {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  for (const effect of effects) {
    switch (effect.type) {
      case "CLEAR_CAPTURE_IN_BACKGROUND":
        chrome.runtime.sendMessage({ type: "CAPTURE_DEACTIVATE" });
        break;
      case "SEND_CAPTURE_ACTIVATE":
        chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVATE", tabId: effect.tabId });
        break;
      case "SEND_CAPTURE_DEACTIVATE":
        chrome.runtime.sendMessage({ type: "CAPTURE_DEACTIVATE" });
        break;
    }
  }
}
