# Web3 Wallet Monitor Dashboard

A Progressive Web App (PWA) to monitor wallet addresses and token balances on BNB Smart Chain.

## Features

- 🔷 Monitor multiple wallet addresses
- 💰 Real-time token balance tracking
- 💵 USDT price display (via OKX API)
- 🔄 Auto-refresh every 30 seconds
- 📱 Progressive Web App support (installable)
- 🎨 Modern, responsive UI

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

## Configuration

- **Chain**: BNB Smart Chain
- **Token Address**: `0x327753B71F11DF3d6809B2436667475Fab8C956E`
- **Refresh Interval**: 30 seconds
- **RPC**: Free public BSC RPC endpoint

## Usage

1. Open the application in your browser
2. Enter a wallet address in the input field
3. Click "Add Wallet" to start monitoring
4. The dashboard will automatically refresh every 30 seconds
5. Install as PWA for offline access (when supported)

## Technologies

- **Viem**: Ethereum library for interacting with BNB chain
- **Vite**: Build tool and dev server
- **Service Worker**: PWA functionality

## Notes

- Token price is fetched from OKX exchange API (with DexScreener fallback)
- Wallet addresses are stored in browser localStorage
- The app uses free public RPC endpoints

## PWA Icons

To generate PWA icons:

1. Open `generate-icons.html` in your browser
2. Download the generated `icon-192.png` and `icon-512.png`
3. Place them in the `public/` directory

Alternatively, you can use online tools or create custom icons and place them in the `public/` folder.
