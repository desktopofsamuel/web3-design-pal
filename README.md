# Web3 Design Pal

A Figma plugin for Web3 mock content: generate wallet addresses and update token price layers directly in design files.

## Capabilities

### 1) Wallet address generator

- Generate mock addresses for Ethereum, Bitcoin, Solana, and Ripple.
- Preview values in the plugin panel and use **Refresh** to roll new ones.
- Optional truncation with configurable start/end character rules.
- **Create / Apply** behavior adapts to selection:
  - No selection -> create one text layer on page.
  - Frame/group selection -> create text in each selected container.
  - Text selection -> replace text; multi-select gets unique address per layer.

Addresses are format-styled for design only (not real, not safe for production wallets).

### 2) New: Price layer updater

Use the **Price** tab to populate token cards with live market values.

- Scan selected nodes for variable tokens:
  - `{crypto}` ticker
  - `{price}` USD price
  - `{change}` 24h change
  - `{volume}` 24h volume
  - `{mcap}` market cap
- Supports token matches in layer names or text content (including embedded tokens like `A${price}`).
- Auto-detects literal ticker text (for example `BTC`) and preserves that ticker while updating sibling data layers.
- Refreshes prices from CoinGecko (or CoinMarketCap when key is available), then applies replacements to matched text layers.
- Price formatting controls live in **Settings** (decimals, currency symbol, comma grouping).

## Platform support

| Where it runs | Notes |
|---|---|
| **Figma** | Primary target. Import via **Plugins -> Development** after build. |
| **FigJam** | Supported for apply workflows where editor APIs are available. |

Requirements:

- Figma desktop (or any Figma surface that allows plugin execution for your account).
- Network access is used for the Price tab market data fetch.

## Development

Main thread logic is in `code.ts` (compiled to `code.js`). UI is in `ui.html`.

```bash
pnpm install
pnpm run build
```

Helpful commands:

- `pnpm run build` -> compile plugin code.
- `pnpm run typecheck` -> TypeScript checks.
- `pnpm run lint` -> lint project files.

Load in Figma via **Plugins -> Development -> Import plugin from manifest...** and select this repo's `manifest.json`.

## UI tests (Playwright)

The suite serves `ui.html` and validates DOM behavior plus plugin `postMessage` contracts.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run test:e2e
```