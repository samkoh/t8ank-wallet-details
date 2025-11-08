import { createPublicClient, http, formatUnits } from 'viem';
import { bsc } from 'viem/chains';
import './styles.css';

// Configuration
const TOKEN_ADDRESS = '0x327753B71F11DF3d6809B2436667475Fab8C956E';
const TOKEN_DECIMALS = 18; // Standard ERC20 decimals, adjust if needed
const BSC_RPC_URL = 'https://bsc-dataseed1.binance.org/'; // Free public RPC
const REFRESH_INTERVAL = 30000; // 30 seconds
const PRICE_API_URL = 'https://www.okx.com/api/v5/market/ticker?instId=';

// ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
];

// Create viem public client for BSC
const publicClient = createPublicClient({
  chain: bsc,
  transport: http(BSC_RPC_URL),
});

// State
let wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
let tokenPrice = null;
let refreshTimer = null;
let countdownTimer = null;
let countdown = 30;

// Pre-populate with default wallets if empty
const defaultWallets = [
  { name: 'G', address: '0x06a9f861862e120d2fd03E9650f033C49aFDD486' },
  { name: 'S', address: '0xc20662c62CbdD15158017d83462486682033070A' },
  { name: 'MT', address: '0x62490673B8D8f37162Cd1886bD499adbA8C1b4D7' },
  { name: 'J', address: '0xE5F8b35bbD79251589517c41B5199C85f0Bf980d' },
  { name: 'Jolly', address: '0x24dEA71Db19BA1483f3d074cD66a43DEfF6A4952' },
  { name: 'Mela', address: '0x8143d908306fA7E64dD149c906e9fBA1efE76c01' },
  { name: 'Meli', address: '0x0E428c6CcF9753BE30A66BaeBc1ECe2a04ed94d6' },
  { name: 'D_2', address: '0x40f1a9E0840dcF069fd74FB83792F59849a30c3B' },
  { name: 'D_3', address: '0x918fc14aFBEBBa1a0E9182d23971f5dD46873a9B' }
];

// Initialize with default wallets if empty
if (wallets.length === 0) {
  wallets = defaultWallets.map(w => ({
    name: w.name,
    address: w.address.toLowerCase()
  }));
  saveWallets();
}

// DOM elements (will be set in init)
let walletNameInput, walletInput, addWalletBtn, clearAllBtn, walletList;
let lastUpdateEl, nextUpdateEl, tokenPriceEl, themeToggle, themeIcon;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Get DOM elements
  walletNameInput = document.getElementById('wallet-name');
  walletInput = document.getElementById('wallet-input');
  addWalletBtn = document.getElementById('add-wallet-btn');
  clearAllBtn = document.getElementById('clear-all-btn');
  walletList = document.getElementById('wallet-list');
  lastUpdateEl = document.getElementById('last-update');
  nextUpdateEl = document.getElementById('next-update');
  tokenPriceEl = document.getElementById('token-price');
  themeToggle = document.getElementById('theme-toggle');
  themeIcon = document.getElementById('theme-icon');
  
  initTheme();
  setupEventListeners();
  renderWallets();
  loadTokenPrice();
  startAutoRefresh();
  updateCountdown();
}

function setupEventListeners() {
  if (addWalletBtn) {
    addWalletBtn.addEventListener('click', addWallet);
  }
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllWallets);
  }
  if (walletInput) {
    walletInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addWallet();
      }
    });
  }
  if (walletNameInput) {
    walletNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (walletInput) walletInput.focus();
      }
    });
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function addWallet() {
  if (!walletInput) {
    console.error('Wallet input not found');
    return;
  }
  
  const name = (walletNameInput?.value.trim() || 'Unnamed');
  const address = walletInput.value.trim();
  
  if (!address) {
    alert('Please enter a wallet address');
    return;
  }
  
  if (!isValidAddress(address)) {
    alert('Invalid wallet address format');
    return;
  }
  
  const addressLower = address.toLowerCase();
  if (wallets.some(w => w.address === addressLower)) {
    alert('Wallet already added');
    return;
  }
  
  wallets.push({
    name: name,
    address: addressLower
  });
  saveWallets();
  if (walletNameInput) walletNameInput.value = '';
  walletInput.value = '';
  renderWallets();
  updateWallet(addressLower);
}

function clearAllWallets() {
  if (wallets.length === 0) return;
  
  if (confirm('Are you sure you want to clear all wallets?')) {
    wallets = [];
    saveWallets();
    renderWallets();
  }
}

function saveWallets() {
  localStorage.setItem('wallets', JSON.stringify(wallets));
}

function removeWallet(address) {
  if (!address) {
    console.error('No address provided to removeWallet');
    return;
  }
  
  const addressLower = address.toLowerCase();
  wallets = wallets.filter(w => w.address !== addressLower);
  saveWallets();
  renderWallets();
  updateTotals();
}

function renderWallets() {
  if (wallets.length === 0) {
    walletList.innerHTML = `
      <div class="empty-state">
        <p>No wallets added yet. Add a wallet address to start monitoring.</p>
      </div>
    `;
    return;
  }
  
  // Create table structure
  walletList.innerHTML = `
    <div class="wallet-table-container">
      <table class="wallet-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>Token Balance</th>
            <th>Total Price (USDT)</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${wallets.map(wallet => `
            <tr class="wallet-row" data-address="${wallet.address}">
              <td class="wallet-name">${escapeHtml(wallet.name)}</td>
              <td class="wallet-address-cell">
                <span class="wallet-address">${formatAddress(wallet.address)}</span>
                <button class="copy-btn" data-address="${wallet.address}" title="Copy address">📋</button>
              </td>
              <td class="balance-value" data-address="${wallet.address}">Loading...</td>
              <td class="usdt-value" data-address="${wallet.address}">Loading...</td>
              <td>
                <button class="remove-btn-small" onclick="removeWallet('${wallet.address}')" title="Remove">×</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td></td>
            <td class="total-balance"><strong>Loading...</strong></td>
            <td class="total-usdt"><strong>Loading...</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
  
  // Update all wallets
  wallets.forEach(wallet => updateWallet(wallet.address));
  
  // Add event listeners for copy buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const address = btn.getAttribute('data-address');
      copyAddress(address, btn);
    });
  });
  
  // Update totals
  updateTotals();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyAddress(address, btn) {
  navigator.clipboard.writeText(address).then(() => {
    // Show feedback
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓';
      btn.style.background = 'var(--success)';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1000);
    }
  }).catch(err => {
    console.error('Failed to copy:', err);
    if (btn) {
      btn.textContent = '✗';
      setTimeout(() => {
        btn.textContent = '📋';
      }, 1000);
    }
  });
}

function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function updateWallet(address) {
  try {
    const balance = await getTokenBalance(address);
    const balanceEl = document.querySelector(`.balance-value[data-address="${address}"]`);
    const usdtEl = document.querySelector(`.usdt-value[data-address="${address}"]`);
    
    if (balanceEl) {
      balanceEl.textContent = formatBalance(balance);
    }
    
    if (usdtEl && tokenPrice !== null) {
      const usdtValue = balance * tokenPrice;
      usdtEl.textContent = formatUSDT(usdtValue);
    } else if (usdtEl) {
      usdtEl.textContent = 'Price loading...';
    }
    
    // Update totals after updating individual wallet
    setTimeout(() => updateTotals(), 100);
  } catch (error) {
    console.error(`Error updating wallet ${address}:`, error);
    const balanceEl = document.querySelector(`.balance-value[data-address="${address}"]`);
    const usdtEl = document.querySelector(`.usdt-value[data-address="${address}"]`);
    
    if (balanceEl) balanceEl.textContent = 'Error';
    if (usdtEl) usdtEl.textContent = 'Error';
    
    // Update totals even if there's an error
    setTimeout(() => updateTotals(), 100);
  }
}

async function getTokenBalance(address) {
  try {
    const balance = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    
    return parseFloat(formatUnits(balance, TOKEN_DECIMALS));
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
}

async function loadTokenPrice() {
  if (!tokenPriceEl) {
    console.error('Token price element not found');
    return;
  }
  
  try {
    // Use DexScreener API (primary source for BSC tokens)
    try {
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESS}`);
      // https://api.dexscreener.com/latest/dex/tokens/0x327753B71F11DF3d6809B2436667475Fab8C956E
      const dexData = await dexResponse.json();
      
      if (dexData.pairs && dexData.pairs.length > 0) {
        // Prioritize PancakeSwap pairs, then find any USDT pair
        const usdtPair = dexData.pairs.find(pair => 
          (pair.dexId === 'pancakeswap' || pair.dexId === 'pancakeswap_v2') &&
          (pair.quoteToken.symbol === 'USDT' || 
           pair.quoteToken.address.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955'.toLowerCase())
        ) || dexData.pairs.find(pair => 
          pair.quoteToken.symbol === 'USDT' || 
          pair.quoteToken.address.toLowerCase() === '0x55d398326f99059ff775485246999027b3197955'.toLowerCase() // BSC USDT
        );
        
        if (usdtPair && usdtPair.priceUsd) {
          const price = parseFloat(usdtPair.priceUsd);
          if (!isNaN(price) && price > 0) {
            tokenPrice = price;
            tokenPriceEl.textContent = formatUSDT(price);
            console.log(`Price loaded from DexScreener: $${price} (${usdtPair.dexId || 'unknown DEX'})`);
            // Update all wallet USDT values
            updateAllWalletPrices();
            return;
          }
        }
      }
    } catch (dexError) {
      console.error('DexScreener API failed:', dexError);
    }
    
    // Try OKX API - need to get token symbol first
    const tokenSymbol = await getTokenSymbol();
    if (tokenSymbol) {
      // OKX uses format: SYMBOL-USDT for spot trading
      const okxSymbol = `${tokenSymbol}-USDT`;
      
      try {
        const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`);
        const data = await response.json();
        
        if (data.code === '0' && data.data && data.data.length > 0) {
          // OKX returns price in the 'last' field
          const price = parseFloat(data.data[0].last);
          
          if (!isNaN(price) && price > 0) {
            tokenPrice = price;
            tokenPriceEl.textContent = formatUSDT(price);
            // Update all wallet USDT values
            updateAllWalletPrices();
            return;
          }
        }
      } catch (okxError) {
        console.log('OKX API failed:', okxError);
      }
    }
    
    // If all APIs fail
    if (tokenPriceEl) {
      tokenPriceEl.textContent = 'Price not available';
    }
    tokenPrice = null;
  } catch (error) {
    console.error('Error loading token price:', error);
    if (tokenPriceEl) {
      tokenPriceEl.textContent = 'Price error';
    }
    tokenPrice = null;
  }
}

function updateAllWalletPrices() {
  if (tokenPrice === null) return;
  
  wallets.forEach(wallet => {
    const usdtEl = document.querySelector(`.usdt-value[data-address="${wallet.address}"]`);
    const balanceEl = document.querySelector(`.balance-value[data-address="${wallet.address}"]`);
    
    if (usdtEl && balanceEl) {
      const balanceText = balanceEl.textContent.trim();
      if (balanceText !== 'Loading...' && balanceText !== 'Error' && !balanceText.startsWith('<')) {
        const balance = parseFloat(balanceText.replace(/,/g, ''));
        if (!isNaN(balance)) {
          const usdtValue = balance * tokenPrice;
          usdtEl.textContent = formatUSDT(usdtValue);
        }
      }
    }
  });
  
  updateTotals();
}

async function getTokenSymbol() {
  try {
    const symbol = await publicClient.readContract({
      address: TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'symbol',
    });
    return symbol;
  } catch (error) {
    console.error('Error getting token symbol:', error);
    return null;
  }
}


function formatBalance(balance) {
  if (balance === 0) return '0';
  if (balance < 0.0001) return '< 0.0001';
  return balance.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0
  });
}

function formatUSDT(value) {
  if (value === 0) return '$0.00';
  if (value < 0.0001) {
    // For very small values, show more decimal places
    return `$${value.toFixed(8).replace(/\.?0+$/, '')}`;
  }
  if (value < 0.01) {
    // For small values, show up to 6 decimal places
    return `$${value.toFixed(6).replace(/\.?0+$/, '')}`;
  }
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}`;
}

function startAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  refreshTimer = setInterval(() => {
    refreshAll();
  }, REFRESH_INTERVAL);
  
  // Start countdown
  countdown = 30;
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  
  countdownTimer = setInterval(() => {
    countdown--;
    updateCountdown();
    if (countdown <= 0) {
      countdown = 30;
    }
  }, 1000);
}

function updateCountdown() {
  nextUpdateEl.textContent = `Next update in: ${countdown}s`;
}

function refreshAll() {
  updateLastUpdateTime();
  loadTokenPrice();
  wallets.forEach(wallet => updateWallet(wallet.address));
  countdown = 30;
  updateTotals();
}

function updateTotals() {
  const balanceElements = document.querySelectorAll('.wallet-table .balance-value');
  const usdtElements = document.querySelectorAll('.wallet-table .usdt-value');
  const totalBalanceEl = document.querySelector('.total-balance');
  const totalUsdtEl = document.querySelector('.total-usdt');
  
  if (!totalBalanceEl || !totalUsdtEl) return;
  
  let totalBalance = 0;
  let totalUsdt = 0;
  
  balanceElements.forEach(el => {
    const text = el.textContent.trim();
    if (text !== 'Loading...' && text !== 'Error' && !text.startsWith('<')) {
      const balance = parseFloat(text.replace(/,/g, ''));
      if (!isNaN(balance)) {
        totalBalance += balance;
      }
    }
  });
  
  usdtElements.forEach(el => {
    const text = el.textContent.trim();
    if (text !== 'Loading...' && text !== 'Error' && text !== 'Price loading...' && !text.startsWith('<')) {
      const usdt = parseFloat(text.replace(/[$,]/g, ''));
      if (!isNaN(usdt)) {
        totalUsdt += usdt;
      }
    }
  });
  
  totalBalanceEl.innerHTML = `<strong>${formatBalance(totalBalance)}</strong>`;
  totalUsdtEl.innerHTML = `<strong>${formatUSDT(totalUsdt)}</strong>`;
}

function updateLastUpdateTime() {
  const now = new Date();
  lastUpdateEl.textContent = `Last update: ${now.toLocaleTimeString()}`;
}

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  if (themeIcon) {
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

// Make functions available globally for onclick handlers
window.removeWallet = function(address) {
  if (confirm('Are you sure you want to remove this wallet?')) {
    removeWallet(address);
  }
};

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, reload page
              window.location.reload();
            }
          });
        });
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
        // Don't show error to user, just log it
      });
  });
}

