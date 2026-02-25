// Background Service Worker for SecureVault
// Handles storage, clipboard, and extension lifecycle events

chrome.runtime.onInstalled.addListener(() => {
  console.log('SecureVault extension installed');
  
  // Initialize extension data if not exists
  chrome.storage.local.get(['vaultEntries', 'connectionStatus'], (result) => {
    if (!result.vaultEntries) {
      chrome.storage.local.set({
        vaultEntries: [],
        connectionStatus: 'disconnected'
      });
    }
  });
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_VAULT_DATA') {
    chrome.storage.local.get(['vaultEntries', 'connectionStatus'], (data) => {
      sendResponse(data);
    });
    return true; // Will respond asynchronously
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
});
