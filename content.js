// Content script - Smart ticker detection for direct right-click
// Detects $TICKER patterns under cursor without selection

let detectedTicker = null;

// Listen for right-click events
document.addEventListener('contextmenu', function(e) {
  detectedTicker = null;
  
  // Method 1: Check if user selected text
  const selection = window.getSelection().toString().trim();
  if (selection) {
    if (isValidTicker(selection)) {
      detectedTicker = selection;
      console.log(`✅ Selection detected: ${detectedTicker}`);
    }
    return; // Let selection menu handle it
  }
  
  // Method 2: Detect ticker under cursor
  const range = document.caretRangeFromPoint(e.clientX, e.clientY);
  if (range && range.startContainer) {
    const container = range.startContainer;
    if (container.nodeType === Node.TEXT_NODE) {
      const text = container.textContent;
      const offset = range.startOffset;
      
      // Look for $TICKER pattern within 10 characters of click
      const startSearch = Math.max(0, offset - 10);
      const endSearch = Math.min(text.length, offset + 10);
      const nearbyText = text.substring(startSearch, endSearch);
      
      const match = nearbyText.match(/\$[A-Z]{2,6}/i);
      if (match) {
        detectedTicker = match[0].toUpperCase();
        console.log(`✅ Cursor detection: ${detectedTicker} at offset ${offset}`);
      }
    }
  }
  
  // Method 3: Check clicked element for ticker
  if (!detectedTicker) {
    const clickedElement = e.target;
    const elementText = clickedElement.textContent || clickedElement.innerText || '';
    const match = elementText.match(/\$[A-Z]{2,6}/i);
    if (match) {
      detectedTicker = match[0].toUpperCase();
      console.log(`✅ Element detection: ${detectedTicker} in ${clickedElement.tagName}`);
    }
  }
  
  // Store for background script
  if (detectedTicker) {
    window.dobbyDetectedTicker = detectedTicker;
  }
}, true);

// Validate ticker format
function isValidTicker(text) {
  const cleanText = text.replace(/^\$/, '').trim();
  return /^[A-Z]{2,6}$/.test(cleanText);
}

// Respond to background script requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDetectedTicker') {
    const ticker = window.dobbyDetectedTicker || null;
    console.log(`📡 Sending detected ticker to background: ${ticker}`);
    sendResponse({ ticker });
  }
  return true; // Keep message channel open
});

// Clean up on page unload
window.addEventListener('beforeunload', function() {
  window.dobbyDetectedTicker = null;
});