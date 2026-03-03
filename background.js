// Background Service Worker for Mobile Vault
// Handles storage, clipboard, capture state (in-memory only), badge, and extension lifecycle.
// Capture does NOT survive browser restart or tab closure.

function setCaptureBadge(active) {
  if (active) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// In-memory only: lost on browser restart; cleared when captured tab is closed
let captureActive = false;
let captureTabId = null;

function clearCapture() {
  captureActive = false;
  captureTabId = null;
  setCaptureBadge(false);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === captureTabId) clearCapture();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Mobile Vault extension installed');

  chrome.storage.local.get(['vaultEntries', 'connectionStatus'], (result) => {
    const updates = {};
    if (!result.vaultEntries) updates.vaultEntries = [];
    if (!result.connectionStatus) updates.connectionStatus = 'disconnected';
    if (Object.keys(updates).length) {
      chrome.storage.local.set(updates);
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_VAULT_DATA') {
    chrome.storage.local.get(['vaultEntries', 'connectionStatus'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (request.type === 'SAVE_VAULT_DATA') {
    chrome.storage.local.set({
      vaultEntries: request.vaultEntries
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'UPDATE_CONNECTION_STATUS') {
    chrome.storage.local.set({
      connectionStatus: request.status
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'CAPTURE_ACTIVATE') {
    const tabId = request.tabId ?? sender.tab?.id ?? null;
    if (tabId == null) {
      sendResponse({ success: false });
      return true;
    }
    captureActive = true;
    captureTabId = tabId;
    setCaptureBadge(true);
    sendResponse({ success: true });
    return true;
  }

  if (request.type === 'CAPTURE_DEACTIVATE') {
    clearCapture();
    sendResponse({ success: true });
    return true;
  }

  if (request.type === 'GET_CAPTURE_STATE') {
    sendResponse({ captureActive });
    return true;
  }
});
