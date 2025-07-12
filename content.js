// Content script for handling text selection and all API functionality
let selectedText = '';
let searchButton = null;
let isButtonVisible = false;

// Create and inject the search button
function createSearchButton() {
  if (searchButton) return searchButton;
  
  searchButton = document.createElement('div');
  searchButton.innerHTML = `
    <div style="
      position: fixed;
      z-index: 10000;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      transition: all 0.2s ease;
      user-select: none;
      display: none;
    " id="maple-search-btn">
      🍁 Search Item
    </div>
  `;
  
  // Add hover effects
  const btn = searchButton.firstElementChild;
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
  });
  
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  });
  
  // Add click handler
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedText) {
      performSearch(selectedText);
      hideSearchButton();
    }
  });
  
  document.body.appendChild(searchButton);
  return searchButton;
}

// Show search button at the end of selection
function showSearchButton(selection) {
  if (!selection || selection.rangeCount === 0) return;
  
  const button = createSearchButton();
  const btn = button.firstElementChild;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  // Position button at the end of selection
  const x = rect.right + window.scrollX + 10;
  const y = rect.top + window.scrollY - 5;
  
  // Ensure button stays within viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const buttonWidth = 100; // approximate button width
  const buttonHeight = 40; // approximate button height
  
  let finalX = x;
  let finalY = y;
  
  // Adjust position if button would go off-screen
  if (x + buttonWidth > viewportWidth + window.scrollX) {
    finalX = rect.left + window.scrollX - buttonWidth - 10;
  }
  
  if (y + buttonHeight > viewportHeight + window.scrollY) {
    finalY = rect.bottom + window.scrollY + 5;
  }
  
  btn.style.left = `${finalX}px`;
  btn.style.top = `${finalY}px`;
  btn.style.display = 'block';
  
  isButtonVisible = true;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (isButtonVisible) {
      hideSearchButton();
    }
  }, 5000);
}

// Hide search button
function hideSearchButton() {
  if (searchButton) {
    const btn = searchButton.firstElementChild;
    btn.style.display = 'none';
    isButtonVisible = false;
  }
}

// Listen for text selection
document.addEventListener('mouseup', (e) => {
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (text && text.length > 0) {
    selectedText = text;
    // Small delay to ensure selection is complete
    setTimeout(() => {
      showSearchButton(selection);
    }, 100);
  } else {
    selectedText = '';
    hideSearchButton();
  }
});

// Hide button when clicking elsewhere
document.addEventListener('mousedown', (e) => {
  if (isButtonVisible && searchButton && !searchButton.contains(e.target)) {
    hideSearchButton();
  }
});

// Hide button when scrolling
document.addEventListener('scroll', () => {
  if (isButtonVisible) {
    hideSearchButton();
  }
});

// Hide button when window is resized
window.addEventListener('resize', () => {
  if (isButtonVisible) {
    hideSearchButton();
  }
});

// Listen for messages from background script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    sendResponse({ selectedText: selectedText });
  } else if (request.action === 'searchItem') {
    // Handle search request from context menu
    performSearch(request.keyword);
  } else if (request.action === 'getItemMetadata') {
    // Handle item metadata request from popup
    getItemMetadata(request.itemId).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'getEnhancementPricing') {
    // Handle enhancement pricing request from popup
    getEnhancementPricing(
      request.itemId, 
      request.upgradeType, 
      request.upgradeSubType, 
      request.itemUpgrade
    ).then(sendResponse);
    return true; // Will respond asynchronously
  }
});

// Perform item search using MSU Navigator API
async function performSearch(keyword) {
  try {
    const searchUrl = `https://msu.io/navigator/api/navigator/search?keyword=${encodeURIComponent(keyword)}`;
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    // Transform the API response to match expected format
    const transformedData = {
      items: data.records ? data.records.map(record => ({
        itemId: record.plainItem?.itemId,
        itemName: record.plainItem?.itemName,
        imageUrl: record.imageUrl,
        category: record.plainItem?.category,
        tokenType: record.plainItem?.tokenType
      })).filter(item => item.itemId && item.itemName) : []
    };
    
    // Store search results in Chrome storage directly
    chrome.storage.local.set({
      lastSearchResults: transformedData,
      lastSearchKeyword: keyword,
      lastSearchTimestamp: Date.now()
    });
    
    // Request background to open popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
    
  } catch (error) {
    console.error('Error searching for item from content script:', error);
    // Store error state
    chrome.storage.local.set({
      lastSearchResults: null,
      lastSearchKeyword: keyword,
      lastSearchTimestamp: Date.now(),
      lastSearchError: error.message
    });
  }
}

// API function for getting item metadata
async function getItemMetadata(itemId) {
  try {
    const metadataUrl = `https://msu.io/navigator/api/navigator/metadata/items/${itemId}/info`;
    const response = await fetch(metadataUrl);
    return await response.json();
  } catch (error) {
    console.error('Error fetching item metadata:', error);
    return null;
  }
}

// API function for getting enhancement pricing
async function getEnhancementPricing(itemId, upgradeType, upgradeSubType = null, itemUpgrade = null) {
  try {
    const currentTime = Math.floor(Date.now() / 1000);
    const oneWeekAgo = currentTime - (7 * 24 * 60 * 60); // 7 days ago
    
    let pricingUrl = `https://msu.io/navigator/api/navigator/msu-stats/dynamic-pricing/enhance-price/history?itemId=${itemId}&period=1&minTimestamp=${oneWeekAgo}&maxTimestamp=${currentTime}`;
    
    if (upgradeType === 'potential') {
      pricingUrl += `&itemUpgradeType=1&itemUpgradeSubType=${upgradeSubType}`;
    } else if (upgradeType === 'starforce') {
      pricingUrl += `&itemUpgrade=${itemUpgrade}`;
    }
    
    const response = await fetch(pricingUrl);
    return await response.json();
  } catch (error) {
    console.error('Error fetching enhancement pricing:', error);
    return null;
  }
}

// Optional: Add visual feedback when text is selected (now handled by search button)
// Button automatically appears when text is selected
