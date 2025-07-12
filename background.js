// Background script for Chrome extension
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: "searchMapleItem",
    title: "Search MapleStory Item: '%s'",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "searchMapleItem") {
    const selectedText = info.selectionText;
    if (selectedText) {
      // Send message to content script to perform the search
      chrome.tabs.sendMessage(tab.id, {
        action: 'searchItem',
        keyword: selectedText
      });
    }
  }
});

// All API functions moved to content script

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPopup') {
    // Handle popup opening request from content script
    chrome.action.openPopup();
  } else if (request.action === 'getItemMetadata' || request.action === 'getEnhancementPricing') {
    // Forward API requests to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, request, sendResponse);
      }
    });
    return true; // Will respond asynchronously
  }
});
