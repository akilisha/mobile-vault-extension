/**
 * Action-aware extension state: holds machine inputs, dispatches actions, runs effects.
 * Relay state (paired, hasQrPayload) comes from c1; capture state is fetched from background
 * on mount and then updated only by dispatching CAPTURE_ACTIVATE / CAPTURE_DEACTIVATE.
 * When relay state changes we dispatch RELAY_STATUS so effects (e.g. clear badge) run.
 */

import { useCallback, useEffect, useState } from "react";
import {
  type ExtensionAction,
  type ExtensionStateInputs,
  extensionReducer,
  getExtensionState,
  runExtensionEffects,
} from "@/lib/extension-state";

export function useExtensionMachine(paired: boolean, hasQrPayload: boolean) {
  const [captureActive, setCaptureActive] = useState(false);
  const [captureSynced, setCaptureSynced] = useState(false);

  const inputs: ExtensionStateInputs = {
    paired,
    hasQrPayload,
    captureActive: paired ? captureActive : false,
  };

  // Fetch capture state from background once on mount
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage || captureSynced) return;
    chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATE" }, (response: { captureActive?: boolean } | undefined) => {
      if (chrome.runtime.lastError) return;
      setCaptureActive(!!response?.captureActive);
      setCaptureSynced(true);
    });
  }, [captureSynced]);

  // When we become disconnected/connecting, run clear-capture effect and clear local capture state
  useEffect(() => {
    if (!paired) {
      runExtensionEffects([{ type: "CLEAR_CAPTURE_IN_BACKGROUND" }]);
      setCaptureActive(false);
    }
  }, [paired]);

  const dispatch = useCallback(
    (action: ExtensionAction) => {
      const prev: ExtensionStateInputs = {
        paired,
        hasQrPayload,
        captureActive: paired ? captureActive : false,
      };
      const { inputs: next, effects } = extensionReducer(prev, action);
      runExtensionEffects(effects);
      if (action.type === "CAPTURE_ACTIVATE") setCaptureActive(true);
      if (action.type === "CAPTURE_DEACTIVATE") setCaptureActive(false);
    },
    [paired, hasQrPayload, captureActive]
  );

  return { ext: getExtensionState(inputs), dispatch, inputs };
}
