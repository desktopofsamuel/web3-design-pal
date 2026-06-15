# Web3 Design Pal

A Figma plugin for Web3 mock content: generate wallet addresses and update token price layers directly in design files.

## Capabilities

### 1) Address generator (Address tab)

- Generate mock addresses for Ethereum, Bitcoin, Solana, and Ripple.
- Preview values in the plugin panel and use **Refresh** (icon on the preview) to roll new ones.
- Optional truncation with configurable start/end character rules.
- **Create / Apply** behavior adapts to selection:
  - No selection -> create one text layer on page.
  - Frame/group selection -> create text in each selected container.
  - Text selection -> replace text; multi-select gets unique address per layer.

Addresses are format-styled for design only (not real, not safe for production wallets).

### 2) Price layer updater (Price tab)

Use the **Price** tab to populate token cards with live market values.

- **CoinGecko API key** — Set your key in **Settings** before **Refresh**; the UI shows a persistent callout until a key is saved.
- Scan selected nodes for variable tokens:
  - `{crypto}` ticker
  - `{price}` price
  - `{change}` 24h change
  - `{volume}` 24h volume
  - `{mcap}` market cap
- Supports token matches in layer names or text content (including embedded tokens like `A${price}`).
- **Figma GRID tables** — Selecting a whole grid/table splits matches into **one card per row** (by grid row index or visual Y position), so each coin row updates independently.
- **Fiat pair labels** — Detects text like `BTC/AUD`, `BTC / AUD`, or `BTCAUD` and applies the matching fiat quote (AUD, EUR, GBP, and others) while preserving the pair label.
- Auto-detects literal ticker text (for example `BTC`) and preserves that ticker while updating sibling data layers.
- Re-apply safe — Updating text again replaces numeric values without duplicating unit suffixes (for example `$33.92B` stays one `B`, not `BB`).
- Refreshes prices from CoinGecko (or CoinMarketCap if configured), including multi-currency quotes, then applies replacements to matched text layers.
- **Coin list** — Default pool of 50 popular tokens (including ETH); your edited list is saved and restored when you reopen the plugin.
- Comma-separated coin list; duplicate symbols are rejected.
- Price formatting controls live in **Settings** (decimals, currency symbol, comma grouping).
- Changing Figma selection clears the last scan until you **Scan** again, so **Update text** stays accurate.

### 3) TxID tab

Coming soon — reserved for future transaction-ID tools.

## Platform support

| Where it runs | Notes |
|---|---|
| **Figma** | Primary target. Import via **Plugins -> Development** after build. |
| **FigJam** | Supported for apply workflows where editor APIs are available. |

Requirements:

- Figma desktop (or any Figma surface that allows plugin execution for your account).
- Network access is used for the Price tab market data fetch.

## Development

Main thread logic lives under `src/` (entry `code.ts`); **`pnpm run build`** bundles everything to `code.js` via esbuild. UI is in `ui.html`.

```bash
pnpm install
pnpm run build
```

Helpful commands:

- `pnpm run build` -> bundle plugin main thread to `code.js`.
- `pnpm run typecheck` -> TypeScript checks.
- `pnpm run lint` -> lint project files.

Load in Figma via **Plugins -> Development -> Import plugin from manifest...** and select this repo's `manifest.json`.

Community icon (128×128): upload `assets/icon.png` when publishing — Figma does not support an `icon` field in [manifest.json](https://developers.figma.com/docs/plugins/manifest/).

## UI tests (Playwright)

The suite serves `ui.html` and validates DOM behavior plus plugin `postMessage` contracts.

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run test:e2e
```

## Support

If this plugin saves you time, [Buy me a coffee](https://buymeacoffee.com/desktopofsamuel).
