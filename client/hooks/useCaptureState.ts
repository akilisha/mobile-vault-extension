/**
 * Capture tab active state synced with background (in-memory only; does not survive browser restart or tab closure).
 */

import { useCallback, useEffect, useState } from "react";

export function useCaptureState(): [boolean, (active: boolean) => void] {
  const [captureActive, setCaptureActiveState] = useState(false);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    chrome.runtime.sendMessage({ type: "GET_CAPTURE_STATE" }, (response: { captureActive?: boolean } | undefined) => {
      if (chrome.runtime.lastError) return;
      setCaptureActiveState(!!response?.captureActive);
    });
  }, []);

  const setCaptureActive = useCallback((active: boolean) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      setCaptureActiveState(active);
      return;
    }
    if (active) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id ?? null;
        if (tabId == null) return;
        chrome.runtime.sendMessage({ type: "CAPTURE_ACTIVATE", tabId }, (resp: { success?: boolean } | undefined) => {
          if (!chrome.runtime.lastError && resp?.success !== false) setCaptureActiveState(true);
        });
      });
    } else {
      chrome.runtime.sendMessage({ type: "CAPTURE_DEACTIVATE" }, () => {
        if (!chrome.runtime.lastError) setCaptureActiveState(false);
      });
    }
  }, []);

  return [captureActive, setCaptureActive];
}
