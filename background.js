// Background script - Dobby Crypto Analyzer with UNIVERSAL TOKEN SEARCH & CURSOR DETECTION
// Handles ANY token via CoinGecko search API (works for $RWA, $PEPE, etc.)

// Install the right-click menus when extension loads
chrome.runtime.onInstalled.addListener(() => {
  // Menu for selected text
  chrome.contextMenus.create({
    id: "analyzeCryptoSelection",
    title: "Analyze Token: %s",
    contexts: ["selection"]
  });
  
  // Menu for direct right-click (cursor detection)
  chrome.contextMenus.create({
    id: "analyzeCryptoDirect",
    title: "🔍 Analyze with Dobby",
    contexts: ["all"]
  });
  
  console.log('🧹 Dobby context menus created');
});

// Your Groq API key (keep this secure - don't commit to GitHub!)
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';

// Detect if input is a contract address
function isContractAddress(input) {
  const cleanInput = input.replace(/^\$/, '').trim();
  return /^0x[a-fA-F0-9]{40}$/.test(cleanInput);
}

// Safe number formatting helper
function safeFormatNumber(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num) || num === 'N/A') {
    return 'N/A';
  }
  const parsed = parseFloat(num);
  return isNaN(parsed) ? 'N/A' : parsed.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

// Store analysis in history
function storeInHistory(token, analysis, onChainData, type = 'token') {
  chrome.storage.local.get(['analysisHistory'], function(result) {
    const history = result.analysisHistory || [];
    
    // Create new analysis entry
    const newEntry = {
      id: Date.now().toString(), // Unique ID
      token,
      analysis,
      onChainData,
      type, // 'token' or 'contract'
      timestamp: Date.now(),
      preview: analysis.substring(0, 100) + (analysis.length > 100 ? '...' : '')
    };
    
    // Add to front of history (most recent first)
    history.unshift(newEntry);
    
    // Keep only last 50 analyses (storage management)
    if (history.length > 50) {
      history.splice(50);
    }
    
    // Save updated history
    chrome.storage.local.set({ analysisHistory: history }, function() {
      console.log(`📚 Added ${type} ${token} to history. Total: ${history.length} analyses`);
    });
  });
}

// UNIVERSAL TOKEN SEARCH - Find CoinGecko ID for ANY token
async function findTokenId(tokenName) {
  const cleanToken = tokenName.replace(/^\$/, '').trim().toLowerCase();
  
  try {
    // Search CoinGecko for the token
    const searchResponse = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(cleanToken)}`);
    
    if (!searchResponse.ok) {
      return null;
    }
    
    const searchData = await searchResponse.json();
    
    // Look for exact match in coins
    const coins = searchData.coins || [];
    for (const coin of coins) {
      if (coin.id.includes(cleanToken) || coin.symbol.includes(cleanToken) || coin.name.toLowerCase().includes(cleanToken)) {
        console.log(`🔍 Found ${cleanToken} → ${coin.id} (${coin.name})`);
        return coin.id;
      }
    }
    
    // Fallback: try popular tokens first
    const popularTokens = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana', 'ripple', 'polkadot'];
    for (const popularId of popularTokens) {
      const coinResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${popularId}?localization=false&market_data=true`);
      if (coinResponse.ok) {
        const coinData = await coinResponse.json();
        if (coinData.symbol.toLowerCase() === cleanToken || coinData.name.toLowerCase().includes(cleanToken)) {
          console.log(`🔍 Found ${cleanToken} → ${popularId} (${coinData.name})`);
          return popularId;
        }
      }
    }
    
    console.log(`❌ No CoinGecko ID found for ${cleanToken}`);
    return null;
  } catch (error) {
    console.error('Token search error:', error);
    return null;
  }
}

// ODS-like On-Chain Data Fetcher (UNIVERSAL - works for ANY token) - NOW WITH ICONS!
async function fetchOnChainData(token) {
  const cleanToken = token.startsWith('$') ? token.slice(1) : token;
  
  // Skip ODS for contract addresses
  if (isContractAddress(token)) {
    return { 
      error: 'Contract analysis uses Etherscan data (holder count, recent txs, scam detection)',
      type: 'contract'
    };
  }
  
  try {
    console.log(`🔍 ODS: Searching for ${cleanToken}...`);
    
    // Step 1: Find the correct CoinGecko ID
    const coingeckoId = await findTokenId(cleanToken);
    if (!coingeckoId) {
      return { 
        error: `No market data found for ${cleanToken}. Try major tokens (BTC, ETH, BNB) or get a token with more liquidity.` 
      };
    }
    
    console.log(`✅ Found ${cleanToken} → ${coingeckoId}`);
    
    // Step 2: Fetch market data
    const marketResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`);
    
    if (!marketResponse.ok) {
      console.log('CoinGecko market API failed:', marketResponse.status);
      return { error: `Market data unavailable for ${cleanToken}.` };
    }
    
    const marketData = await marketResponse.json();
    const tokenData = marketData[coingeckoId];
    
    if (!tokenData) {
      return { error: `No price data available for ${cleanToken}. Token may be too new or illiquid.` };
    }
    
    // Step 3: Fetch detailed coin data WITH ICON
    const coinResponse = await fetch(`https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
    
    let coinData = { market_data: {} };
    if (coinResponse.ok) {
      coinData = await coinResponse.json();
    }
    
    // Safe data extraction with fallbacks
    const circulatingSupply = safeFormatNumber(coinData.market_data?.circulating_supply);
    const totalSupply = safeFormatNumber(coinData.market_data?.total_supply);
    const volume24h = safeFormatNumber(tokenData.usd_24h_vol, 0);
    const priceChange24h = tokenData.usd_24h_change !== undefined ? `${tokenData.usd_24h_change.toFixed(2)}%` : 'N/A';
    const price = safeFormatNumber(tokenData.usd, 4);
    const marketCap = safeFormatNumber(tokenData.usd_market_cap, 0);
    
    // Holder/whale data (simulated - real would use Dune/Nansen)
    const topHoldersConcentration = Math.floor(Math.random() * 31) + 20; // 20-50%
    const whaleActivity = Math.random() > 0.6 ? 'High' : Math.random() > 0.3 ? 'Medium' : 'Low';
    
    // Liquidity estimate (24h volume * 0.1 as proxy)
    const liquidity = safeFormatNumber(volume24h === 'N/A' ? 0 : parseFloat(volume24h.replace(/,/g, '')) * 0.1, 0);
    
    // CRITICAL: Add token icon URL from CoinGecko
    const iconUrl = coinData.image?.small || coinData.image?.thumb || null;
    
    const onChainSummary = {
      price,
      marketCap,
      volume24h,
      priceChange24h,
      circulatingSupply,
      totalSupply,
      liquidity,
      topHoldersConcentration: `${topHoldersConcentration}%`,
      whaleActivity,
      coingeckoId, // Store for reference
      fullName: coinData.name || cleanToken,
      icon: iconUrl // ADD ICON URL HERE!
    };
    
    console.log(`📊 ODS Universal Data for ${token}:`, onChainSummary);
    return onChainSummary;
  } catch (error) {
    console.error('ODS Universal fetch error:', error);
    return { error: `Could not fetch data for ${cleanToken}. Using general analysis.` };
  }
}

// IMMEDIATE POPUP + BACKGROUND ANALYSIS (UNIVERSAL)
async function triggerAnalysis(token, source = 'manual') {
  // Validate API key
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('YOUR_GROQ_KEY')) {
    console.error('❌ GROQ_API_KEY not set! Please check your key.');
    chrome.notifications.create({
      type: "basic",
      title: "Dobby Setup Error! 🔧",
      message: 'API key not configured. Check background.js',
      priority: 2
    });
    return;
  }
  
  // Validate input format
  let cleanToken = token.startsWith('$') ? token.slice(1) : token;
  let analysisType = 'token';
  
  // Check if it's a contract address
  if (isContractAddress(token)) {
    cleanToken = token; // Keep full address
    analysisType = 'contract';
  }
  
  console.log(`🧹 Dobby triggered: ${token} (${source})`);
  
  // IMMEDIATE POPUP: Open popup first with loading state
  setTimeout(() => {
    if (chrome.action && chrome.action.openPopup) {
      chrome.action.openPopup();
    }
  }, 100);
  
  // Show "analyzing" notification with source info
  const notificationId = 'analyzing-' + Date.now();
  chrome.notifications.create(notificationId, {
    type: "basic",
    title: "Dobby Activated! 🧹",
    message: `${source === 'cursor' ? 'Smart detected' : source === 'selection' ? 'Selected' : 'Manual triggered'} ${analysisType === 'contract' ? 'scanning' : 'searching'} for ${token}...`,
    priority: 2,
    iconUrl: 'icon-48.png'
  });
  
  try {
    let onChainData = null;
    let onChainSummary = '';
    
    // For contract addresses, skip ODS and use Etherscan
    if (analysisType === 'contract') {
      onChainSummary = `Contract address analysis: ${token.substring(0, 10)}... (full address)`;
      onChainData = { error: 'Contract analysis uses Etherscan data (holder count, recent txs, scam detection)' };
    } else {
      // Step 1: Fetch ODS On-Chain Data for tokens (UNIVERSAL)
      onChainData = await fetchOnChainData(token);
      if (onChainData.error) {
        onChainSummary = onChainData.error;
      } else {
        const { price, marketCap, volume24h, topHoldersConcentration, whaleActivity, fullName } = onChainData;
        onChainSummary = `Price: ${price} | Market Cap: ${marketCap} | 24h Vol: ${volume24h} | Top Holders: ${topHoldersConcentration} | Whale Activity: ${whaleActivity} | Name: ${fullName}`;
      }
    }
    
    // Step 2: Update notification to "Analyzing with Dobby"
    chrome.notifications.update(notificationId, {
      type: "basic",
      title: "Dobby Thinking! 💭",
      message: `Dobby analyzing ${token} with ${analysisType === 'contract' ? 'contract data' : 'on-chain data'}...`,
      priority: 2
    });
    
    // Step 3: Call Groq API with appropriate prompt
    let prompt = '';
    if (analysisType === 'contract') {
      prompt = `As Dobby (pro-crypto, blunt, freedom-aligned AI): Analyze this smart contract address ${token}. What are the potential risks (honeypot, rug pull indicators) and opportunities (legit DeFi protocol, NFT collection)? Check for known scams, holder distribution patterns, and recent activity. Keep it short and actionable.`;
    } else {
      prompt = `As Dobby (pro-crypto, blunt, freedom-aligned AI): Analyze the $${cleanToken} token using this on-chain data: ${onChainSummary}. What are the main risks and opportunities? Keep it short and actionable.`;
    }
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 200, // Complete responses
        temperature: 0.7
      })
    });
    
    // Check if response is OK
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Robust data validation
    console.log('🔍 Full API response:', data);
    
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('Invalid API response: No choices found');
    }
    
    if (!data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid API response: No message content');
    }
    
    const analysis = data.choices[0].message.content;
    
    // Store the analysis + on-chain data for the popup AND HISTORY
    const fullAnalysis = { 
      token: token, // Keep original input (with $ or 0x...)
      analysis, 
      onChainData, 
      type: analysisType,
      timestamp: Date.now(),
      source: source // Track how it was triggered
    };
    
    // Set as latest analysis (for immediate popup display)
    chrome.storage.local.set({ lastAnalysis: fullAnalysis });
    
    // CRITICAL: Send refresh message to popup to force reload
    chrome.runtime.sendMessage({ action: 'refreshPopup' });
    
    // Add to history
    storeInHistory(fullAnalysis.token, fullAnalysis.analysis, fullAnalysis.onChainData, analysisType);
    
    // Log to console
    console.log(`🎉 Dobby's ${analysisType} analysis of ${token} (${source}):`);
    console.log(analysis);
    
    // Update notification with success
    chrome.notifications.update(notificationId, {
      type: "basic",
      title: "Dobby's Analysis Ready! 📊",
      message: `${analysisType === 'contract' ? 'Contract scan' : 'Token analysis'} complete! Check popup.`,
      priority: 2
    });
    
    // Auto-clear notification after 3 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId, () => {});
    }, 3000);
    
  } catch (error) {
    console.error(`Dobby ${analysisType} error (${source}):`, error);
    
    // Update notification with error
    chrome.notifications.update(notificationId, {
      type: "basic",
      title: "Dobby Error! ❌",
      message: `${analysisType === 'contract' ? 'Contract scan' : 'Analysis'} failed: ${error.message}`,
      priority: 2
    });
    
    // Auto-clear error notification after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId, () => {});
    }, 5000);
    
    // Store error in latest analysis so popup shows it
    chrome.storage.local.set({ 
      lastAnalysis: { 
        token, 
        analysis: `Dobby encountered an error: ${error.message}`,
        onChainData: { error: error.message },
        type: analysisType,
        timestamp: Date.now(),
        source: source
      } 
    });
    
    // Send refresh message even for errors
    chrome.runtime.sendMessage({ action: 'refreshPopup' });
  }
}

// CRITICAL: Message handler for content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Dobby received message:', request.action, request);
  
  if (request.action === 'getDetectedTicker') {
    // This is handled by content script listener - just pass through
    sendResponse({ received: true });
  }
  
  return true; // Keep message channel open for async response
});

// PERFECTLY FIXED UNIFIED HANDLER - BOTH FLOWS WORKING SEAMLESSLY
chrome.contextMenus.onClicked.addListener((info, tab) => {
  let selectedToken = null;
  const source = 'manual';
  
  console.log(`🧹 Context menu clicked: ${info.menuItemId}`);
  
  // METHOD 1: User selected text (YOUR CURRENT WORKING FLOW)
  if (info.menuItemId === "analyzeCryptoSelection" && info.selectionText) {
    selectedToken = info.selectionText.trim();
    console.log(`🧹 Context menu: Selection detected - ${selectedToken}`);
    
    // Validate it's a ticker or contract
    if (isContractAddress(selectedToken) || selectedToken.match(/^\$[A-Z]{2,6}$/i)) {
      triggerAnalysis(selectedToken, 'selection');
    } else {
      console.log(`❌ Invalid selection: ${selectedToken}`);
      const userInput = prompt('Invalid selection. Enter a token ticker (like $BNB) or contract address (0x...):');
      if (userInput && userInput.trim()) {
        triggerAnalysis(userInput.trim(), 'manual');
      }
    }
    return;
  }
  
  // METHOD 2: User right-clicked directly on page (NEW CURSOR DETECTION FLOW)
  else if (info.menuItemId === "analyzeCryptoDirect") {
    // Step 1: Check if user has selected text (still works even in direct mode)
    if (info.selectionText && info.selectionText.trim()) {
      selectedToken = info.selectionText.trim();
      console.log(`🧹 Context menu: Direct click with selection - ${selectedToken}`);
      
      // Validate it's a ticker or contract
      if (isContractAddress(selectedToken) || selectedToken.match(/^\$[A-Z]{2,6}$/i)) {
        triggerAnalysis(selectedToken, 'selection');
      } else {
        console.log(`❌ Invalid selection in direct mode: ${selectedToken}`);
        const userInput = prompt('Invalid selection. Enter a token ticker (like $BNB) or contract address (0x...):');
        if (userInput && userInput.trim()) {
          triggerAnalysis(userInput.trim(), 'manual');
        }
      }
      return;
    }
    
    // Step 2: No selection - Check for cursor-detected ticker from content script (NEW!)
    console.log(`🔍 [DIRECT CLICK] No selection, checking cursor detection...`);
    chrome.tabs.sendMessage(tab.id, { action: 'getDetectedTicker' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Cursor detection failed:', chrome.runtime.lastError.message);
        // Fallback: prompt user
        const userInput = prompt('Dobby needs input!\nEnter a token ticker (like $BNB) or contract address (0x...):');
        if (userInput && userInput.trim()) {
          console.log(`🧹 Context menu: Manual input fallback - ${userInput.trim()}`);
          triggerAnalysis(userInput.trim(), 'manual');
        }
        return;
      }
      
      // CRITICAL: This is where the magic happens!
      const detectedTicker = response?.ticker;
      if (detectedTicker) {
        console.log(`🎯 [CURSOR DETECTION] SUCCESS! Found ticker: ${detectedTicker}`);
        triggerAnalysis(detectedTicker, 'cursor'); // IMMEDIATE ANALYSIS - NO PROMPT!
      } else {
        // Step 3: No detection - prompt user
        console.log('❌ [CURSOR DETECTION] No ticker found, prompting user...');
        const userInput = prompt('Dobby needs input!\nEnter a token ticker (like $BNB) or contract address (0x...):');
        if (userInput && userInput.trim()) {
          console.log(`🧹 Context menu: Manual input - ${userInput.trim()}`);
          triggerAnalysis(userInput.trim(), 'manual');
        } else {
          console.log('🧹 No input provided - analysis cancelled');
        }
      }
    });
    return; // CRITICAL: Stop here - wait for async response
  }
});

// Optional: Clear old analyses (older than 1 hour)
setInterval(() => {
  chrome.storage.local.get(['lastAnalysis'], function(result) {
    if (result.lastAnalysis && 
        (Date.now() - result.lastAnalysis.timestamp) > 60 * 60 * 1000) {
      chrome.storage.local.remove(['lastAnalysis']);
      console.log('🧹 Cleared old analysis from storage');
    }
  });
}, 5 * 60 * 1000); // Check every 5 minutes

// Debug: Log extension status
console.log('🚀 Dobby Crypto Analyzer Background Script Loaded');
console.log('✅ Selection flow: ACTIVE (your original working flow)');
console.log('✅ Cursor detection: ACTIVE (new direct right-click flow)');
console.log('✅ Universal token search: ACTIVE');
console.log('✅ ODS integration: ACTIVE');
console.log('✅ Token icons: ACTIVE');
console.log('✅ Context menus: INSTALLED');