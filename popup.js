// Popup script - Dobby Crypto Analyzer with FULLY CLICKABLE HISTORY + TOKEN ICONS + FIXED BUTTONS
// Displays immediate loading + complete analysis + interactive history + token-specific icons

document.addEventListener('DOMContentLoaded', function() {
  const loadingDiv = document.getElementById('loading');
  const analysisDiv = document.getElementById('analysis');
  const historyLoading = document.getElementById('history-loading');
  const historyContent = document.getElementById('history-content');
  
  let currentHistory = [];
  let isLoading = false;
  let currentView = 'latest'; // Track which tab is active
  
  // Show immediate loading state
  function showLoadingState() {
    isLoading = true;
    loadingDiv.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 16px; color: #8B5CF6; margin-bottom: 8px;">🧹 Dobby is analyzing...</div>
        <div style="color: #6B7280; font-size: 14px;">Fetching on-chain data and AI insights</div>
        <div style="margin-top: 16px;">
          <div class="loading-dots">•</div>
          <div class="loading-dots" style="animation-delay: 0.2s;">•</div>
          <div class="loading-dots" style="animation-delay: 0.4s;">•</div>
        </div>
      </div>
    `;
    loadingDiv.style.display = 'block';
    analysisDiv.style.display = 'none';
  }
  
  // Hide loading and show content
  function hideLoading() {
    isLoading = false;
    loadingDiv.style.display = 'none';
    analysisDiv.style.display = 'block';
  }
  
  // Format analysis function (for both latest and history) - NOW WITH ICON SUPPORT
  function formatAnalysis(rawText, token, onChainData = null, type = 'token', isHistory = false) {
    // Build token header with optional icon
    let tokenHeader = '';
    
    // Contract address styling (no icon)
    if (type === 'contract') {
      tokenHeader = `
        <div class="token-header" style="font-family: monospace; font-size: 12px; display: flex; align-items: center; gap: 8px;">
          <span>📜</span>
          <div>
            <strong>Contract Analysis</strong><br>
            <span style="color: #6B7280; font-size: 11px;">${token}</span>
          </div>
        </div>
      `;
    } else {
      // Token header with icon (if available)
      const iconHtml = onChainData?.icon ? 
        `<img src="${onChainData.icon}" class="token-icon" alt="${token} icon" onerror="this.style.display='none'; this.outerHTML='<div class=\\'token-icon-placeholder\\' style=\\'width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 16px; color: #8B5CF6;\\'>?</div>'" style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);">` :
        `<div class="token-icon-placeholder" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 16px; color: #8B5CF6;">?</div>`;
      
      tokenHeader = `
        <div class="token-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;">
          ${iconHtml}
          <div style="flex: 1;">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">${token}</div>
            ${onChainData?.fullName ? `<div style="font-size: 12px; color: #9CA3AF; opacity: 0.8;">${onChainData.fullName}</div>` : ''}
          </div>
        </div>
      `;
    }
    
    let formatted = tokenHeader;
    
    // Add ODS On-Chain Stats section
    if (onChainData && !onChainData.error && type === 'token') {
      formatted += `
        <div class="onchain-section">
          <div class="section-header">📊 On-Chain Stats (via ODS)</div>
          <div class="stats-grid">
            <div><strong>Price:</strong> ${safeDisplayData(onChainData.price)}</div>
            <div><strong>Market Cap:</strong> ${safeDisplayData(onChainData.marketCap)}</div>
            <div><strong>24h Volume:</strong> ${safeDisplayData(onChainData.volume24h)}</div>
            <div><strong>24h Change:</strong> <span style="color: ${getChangeColor(onChainData.priceChange24h)};">${safeDisplayData(onChainData.priceChange24h)}</span></div>
            <div><strong>Circ. Supply:</strong> ${safeDisplayData(onChainData.circulatingSupply)}</div>
            <div><strong>Liquidity:</strong> ${safeDisplayData(onChainData.liquidity)}</div>
            <div><strong>Top Holders:</strong> ${safeDisplayData(onChainData.topHoldersConcentration)}</div>
            <div><strong>Whale Activity:</strong> ${safeDisplayData(onChainData.whaleActivity)}</div>
          </div>
        </div>
      `;
    } else if (onChainData?.error && type === 'token') {
      formatted += `<div class="warning">⚠️ ${onChainData.error}</div>`;
    }
    
    formatted += `<div class="analysis-content">`;
    
    // Convert **bold** to <strong>
    let processed = rawText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert * lists to styled bullet points
    processed = processed.replace(/^\*\s+(.*)$/gm, '<div class="bullet-item"><span class="bullet">•</span><span class="bullet-text">$1</span></div>');
    
    // Convert - lists to styled bullet points  
    processed = processed.replace(/^-\s+(.*)$/gm, '<div class="bullet-item"><span class="bullet">•</span><span class="bullet-text">$1</span></div>');
    
    // Convert numbered lists
    processed = processed.replace(/^(\d+)\.\s+(.*)$/gm, '<div class="numbered-item">$1. <span class="numbered-text">$2</span></div>');
    
    // Line breaks to <br> but preserve paragraphs
    processed = processed.replace(/\n\s*\n/g, '</div><div class="paragraph">');
    processed = processed.replace(/\n/g, '<br>');
    
    formatted += processed;
    formatted += `</div>`;
    
    // Add history indicator if this is from history
    if (isHistory) {
      formatted += `<div class="history-indicator">📚 From History</div>`;
    }
    
    return formatted;
  }
  
  // Color-code price changes
  function getChangeColor(change) {
    if (!change || change === 'N/A') return '#6B7280';
    const value = parseFloat(change);
    return isNaN(value) ? '#6B7280' : value >= 0 ? '#10B981' : '#EF4444'; // Green/Red
  }
  
  // Safe data display helper
  function safeDisplayData(data) {
    if (data === null || data === undefined || data === 'N/A') return 'N/A';
    if (typeof data === 'number') return data.toLocaleString();
    return String(data);
  }
  
  // Tab switching
  window.showTab = function(tabName) {
    currentView = tabName;
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tabName + '-tab').classList.add('active');
    document.getElementById(tabName + '-tab-btn').classList.add('active');
    
    // Load tab content
    if (tabName === 'history') {
      loadHistory();
    } else {
      loadLatest();
    }
  }
  
  // Load latest analysis
  function loadLatest() {
    chrome.storage.local.get(['lastAnalysis'], function(result) {
      if (result.lastAnalysis && 
          (Date.now() - result.lastAnalysis.timestamp) < 30 * 60 * 1000) { // 30 minutes
        hideLoading();
        
        const token = result.lastAnalysis.token;
        const type = result.lastAnalysis.type || 'token';
        const html = formatAnalysis(result.lastAnalysis.analysis, token, result.lastAnalysis.onChainData, type, false);
        
        analysisDiv.innerHTML = html;
        
        // Add timestamp
        const timeAgo = getTimeAgo(result.lastAnalysis.timestamp);
        analysisDiv.innerHTML += `<div class="timestamp">Latest • ${timeAgo} | Powered by ODS + Dobby</div>`;
        
        // Scroll to top
        analysisDiv.scrollTop = 0;
      } else if (!isLoading) {
        // Show initial state (not loading from analysis)
        analysisDiv.style.display = 'none';
        loadingDiv.innerHTML = `
          <div style="text-align: center; color: #6B7280;">
            <div>🔍 Select a token ticker like <strong>$BNB</strong></div>
            <div style="font-size: 12px; margin-top: 8px;">Right-click → "Analyze with Dobby"</div>
          </div>
        `;
        loadingDiv.style.display = 'block';
      }
    });
  }
  
  // Load history - NOW WITH ICON SUPPORT
  function loadHistory() {
    historyLoading.style.display = 'block';
    historyContent.style.display = 'none';
    
    chrome.storage.local.get(['analysisHistory'], function(result) {
      currentHistory = result.analysisHistory || [];
      
      if (currentHistory.length === 0) {
        historyLoading.innerHTML = `
          <div class="history-empty">
            <div style="font-size: 16px; margin-bottom: 8px;">📚 No analyses yet</div>
            <div style="font-size: 14px;">Right-click a token to get started!</div>
          </div>
        `;
        historyLoading.style.display = 'block';
        return;
      }
      
      let html = `
        <div style="margin-bottom: 12px;">
          <div style="font-weight: 600; color: #374151; font-size: 14px; margin-bottom: 8px;">
            ${currentHistory.length} Analyses
          </div>
          <button class="clear-all-btn" id="clearHistoryBtn">Clear All</button>
        </div>
      `;
      
      currentHistory.forEach(item => {
        const timeAgo = getTimeAgo(item.timestamp);
        const hasOnChain = item.onChainData && !item.onChainData.error && item.type === 'token';
        const onChainBadge = hasOnChain ? '<span style="background: #0EA5E9; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">ODS</span>' : '';
        const typeBadge = item.type === 'contract' ? '<span style="background: #F59E0B; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Contract</span>' : '';
        
        // Icon for history item
        let iconHtml = '';
        if (item.onChainData?.icon && item.type !== 'contract') {
          iconHtml = `<img src="${item.onChainData.icon}" class="history-icon" alt="${item.token} icon" onerror="this.style.display='none'" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">`;
        } else if (item.type === 'contract') {
          iconHtml = '<span style="width: 24px; height: 24px; border-radius: 50%; background: #F59E0B; color: white; font-size: 12px; display: flex; align-items: center; justify-content: center; margin-right: 8px;">📜</span>';
        } else {
          iconHtml = '<div class="history-icon-placeholder" style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #8B5CF6; margin-right: 8px;">?</div>';
        }
        
        html += `
          <div class="history-item" data-history-id="${item.id}">
            <div style="display: flex; align-items: center;">
              ${iconHtml}
              <div style="flex: 1;">
                <div class="history-token">${item.token}</div>
                ${typeBadge}${onChainBadge}
              </div>
            </div>
            <div class="history-preview">${item.preview}</div>
            <div class="history-time">${timeAgo}</div>
          </div>
        `;
      });
      
      historyContent.innerHTML = html;
      historyLoading.style.display = 'none';
      historyContent.style.display = 'block';
      
      // Add click listeners to history items
      document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', function() {
          const historyId = this.getAttribute('data-history-id');
          loadHistoryAnalysis(historyId);
        });
      });
      
      // Add clear history event listener
      const clearBtn = document.getElementById('clearHistoryBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', clearAllHistory);
      }
    });
  }
  
  // Load specific history analysis into latest tab (FULLY INTERACTIVE WITH ICONS)
  function loadHistoryAnalysis(historyId) {
    const item = currentHistory.find(h => h.id === historyId);
    if (item) {
      // Switch to latest tab
      showTab('latest');
      
      // Show loading briefly for smooth transition
      showLoadingState();
      setTimeout(() => {
        // Display the historical analysis
        hideLoading();
        const token = item.token;
        const type = item.type || 'token';
        const html = formatAnalysis(item.analysis, token, item.onChainData, type, true);
        
        analysisDiv.innerHTML = html;
        
        // Update timestamp to show it's historical
        const timeAgo = getTimeAgo(item.timestamp);
        analysisDiv.innerHTML += `<div class="timestamp">From History • ${timeAgo} | Powered by ODS + Dobby</div>`;
        
        // Add "Back to History" button with proper event listener
        const backButton = document.createElement('button');
        backButton.innerHTML = '← Back to History';
        backButton.style.cssText = 'background: #6B7280; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; border: none; color: white; margin-top: 16px; text-align: center; width: 100%;';
        backButton.onclick = () => showTab('history');
        analysisDiv.appendChild(backButton);
        
        // Scroll to top
        analysisDiv.scrollTop = 0;
      }, 300);
    }
  }
  
  // Clear all history
  function clearAllHistory() {
    if (confirm('Clear all analysis history? This cannot be undone.')) {
      chrome.storage.local.remove(['analysisHistory'], function() {
        currentHistory = [];
        loadHistory();
      });
    }
  }
  
  // Tab event listeners
  document.getElementById('latest-tab-btn').addEventListener('click', () => showTab('latest'));
  document.getElementById('history-tab-btn').addEventListener('click', () => showTab('history'));
  
  // Close button functionality
  document.getElementById('closeBtn').addEventListener('click', function() {
    window.close();
  });
  
  // Listen for immediate loading from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showLoading') {
      showLoadingState();
      sendResponse({success: true});
    } else if (request.action === 'refreshPopup') {
      // CRITICAL: Force reload when new analysis is ready
      console.log('🔄 [POPUP] Refreshing for new analysis');
      if (!isLoading) {
        loadLatest(); // Reload the latest analysis
      }
      sendResponse({ refreshed: true });
    }
    return true;
  });
  
  // Load initial tab (latest)
  loadLatest();
});

// Helper function for time ago
function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

// Loading animation CSS (add to popup.html <style>)
const loadingCSS = `
  .loading-dots {
    display: inline-block;
    animation: pulse 1.4s infinite ease-in-out;
    color: #8B5CF6;
  }
  .loading-dots:nth-child(2) { animation-delay: 0.2s; }
  .loading-dots:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse {
    0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }
`;
const style = document.createElement('style');
style.textContent = loadingCSS;
document.head.appendChild(style);

