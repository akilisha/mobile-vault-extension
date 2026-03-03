/**
 * Background service worker entry. Bundled to background.js.
 * Handles: relay (WebSocket + state), capture, vault storage, badge.
 */

import { RelayEngine } from "./lib/relay-engine";
import type { RelayEngineState } from "./lib/relay-engine";

const base = String(import.meta.env.VITE_RELAY_URL || "ws://localhost:3000/ws").replace(/\/+$/, "");
const DEFAULT_RELAY_URL = base.endsWith("/ws") ? base : `${base}/ws`;

// Capture state (in-memory only)
let captureActive = false;
let captureTabId: number | null = null;
let relayConnected = false;

function setBadge() {
  if (captureActive) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  } else if (relayConnected) {
    chrome.action.setBadgeText({ text: "●" });
    chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

function clearCapture() {
  captureActive = false;
  captureTabId = null;
  setBadge();
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === captureTabId) clearCapture();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Mobile Vault extension installed");
  chrome.storage.local.get(["vaultEntries", "connectionStatus"], (result) => {
    const updates: Record<string, unknown> = {};
    if (!result.vaultEntries) updates.vaultEntries = [];
    if (!result.connectionStatus) updates.connectionStatus = "disconnected";
    if (Object.keys(updates).length) chrome.storage.local.set(updates);
  });
});

const relayEngine = new RelayEngine(DEFAULT_RELAY_URL, (state: RelayEngineState) => {
  relayConnected = state.paired && state.status.kind === "paired";
  setBadge();
  chrome.runtime.sendMessage({ type: "RELAY_STATE", payload: state }).catch(() => {
    // Popup may be closed
  });
});

chrome.runtime.onMessage.addListener(
  (
    request: {
      type: string;
      payload?: unknown;
      tabId?: number;
      vaultEntries?: unknown;
      status?: string;
      url?: string;
      groupId?: string;
      key?: string;
      form?: unknown;
      editingId?: string | null;
      relayUrl?: string;
    },
    sender,
    sendResponse
  ) => {
    // Vault storage
    if (request.type === "GET_VAULT_DATA") {
      chrome.storage.local.get(["vaultEntries", "connectionStatus"], (data) => {
        sendResponse(data);
      });
      return true;
    }
    if (request.type === "SAVE_VAULT_DATA") {
      chrome.storage.local.set({ vaultEntries: request.vaultEntries }, () => {
        sendResponse({ success: true });
      });
      return true;
    }
    if (request.type === "UPDATE_CONNECTION_STATUS") {
      chrome.storage.local.set({ connectionStatus: request.status }, () => {
        sendResponse({ success: true });
      });
      return true;
    }

    // Capture
    if (request.type === "CAPTURE_ACTIVATE") {
      const tabId = request.tabId ?? sender.tab?.id ?? null;
      if (tabId == null) {
        sendResponse({ success: false });
        return true;
      }
      captureActive = true;
      captureTabId = tabId;
      setBadge();
      sendResponse({ success: true });
      return true;
    }
    if (request.type === "CAPTURE_DEACTIVATE") {
      clearCapture();
      sendResponse({ success: true });
      return true;
    }
    if (request.type === "GET_CAPTURE_STATE") {
      sendResponse({ captureActive });
      return true;
    }

    // Relay
    if (request.type === "GET_RELAY_STATE") {
      sendResponse(relayEngine.getState());
      return true;
    }
    if (request.type === "RELAY_CONNECT") {
      const url = (request.url ?? relayEngine.getState().relayUrl) as string;
      relayEngine.connect(url);
      sendResponse({ success: true });
      return true;
    }
    if (request.type === "RELAY_DISCONNECT") {
      relayEngine.disconnect();
      sendResponse({ success: true });
      return true;
    }
    if (request.type === "RELAY_REFRESH") {
      relayEngine
        .refreshVault()
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true;
    }
    if (request.type === "RELAY_SAVE_ROW") {
      relayEngine
        .saveRow()
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true;
    }
    if (request.type === "RELAY_REMOVE_ROW") {
      const groupId = request.groupId as string;
      const key = request.key as string;
      relayEngine
        .removeRow(groupId, key)
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true;
    }
    if (request.type === "RELAY_SET_FORM") {
      relayEngine.setForm(request.form as RelayEngineState["form"]);
      sendResponse({ success: true });
      return true;
    }
    if (request.type === "RELAY_SET_EDITING_ID") {
      relayEngine.setEditingId(request.editingId ?? null);
      sendResponse({ success: true });
      return true;
    }
    if (request.type === "RELAY_SET_RELAY_URL") {
      relayEngine.setRelayUrl((request.relayUrl as string) ?? "");
      sendResponse({ success: true });
      return true;
    }

    return false;
  }
);
