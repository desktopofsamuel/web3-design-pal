<!-- Used for Figma Plugin Publishing -->

# Name
Web3 Design Pal

# Tagline (Within 10 words)
Your friendly design helper for your Web3 design

# Description (Within 300 words and breakdown by bullet point)
- **Address tab** — Drop realistic mock wallet strings (ETH / SOL / BTC / XRP styles) into frames in one go; preview + refresh, optional truncation, **Create** or **Apply** by selection. Skip manual copy-paste from generators.
- **Price tab** — Scan selection, **Refresh** live data, **Update text** on `{crypto}` / `{price}` / `{change}` / `{volume}` / `{mcap}` in layer names or copy. Works with **Figma GRID tables** (one card per row), **fiat pairs** like `BTC/AUD`, literal tickers, and prefix styles such as `A${price}`. Re-apply updates numbers without breaking labels or duplicating suffixes.
- **Settings** — Save your **CoinGecko** key once; a yellow callout nudges you if it’s missing. Tune price formatting (decimals, `$`, commas). Coin list defaults to 50 popular tokens (including ETH) and persists across sessions.
- **TxID tab** — Coming soon; today’s workflows are **Address** and **Price**.
- **Design-only** — Mock data for layouts and decks, not real wallets or trading advice.
- **Support** — Enjoying the plugin? [Buy me a coffee](https://buymeacoffee.com/desktopofsamuel).

# Changelog (v0.3.0)

- **Figma GRID tables** — Scanning a whole table now treats each row as its own card, so `{crypto}`, `{price}`, `{change}`, and other tokens update per coin row instead of merging into one.
- **Fiat pair labels** — Detects `BTC/AUD`, `BTC / AUD`, `BTCAUD`, and similar pair text; applies the matching fiat quote (AUD, EUR, GBP, and more) while keeping the label unchanged.
- **Multi-currency prices** — Refresh fetches USD plus supported fiat quotes from CoinGecko / CoinMarketCap for accurate local-currency mock data.
- **Smarter re-apply** — Preserves literal tickers (e.g. `BTC`), currency prefixes (e.g. `A$`), and surrounding copy; replaces only the numeric part when updating again.
- **Volume / market cap fix** — Re-running **Update text** no longer stacks unit suffixes (`B` → `BB`); corrupted suffixes self-heal on the next update.
- **Coin list persistence** — Your comma-separated coin pool is saved and restored when you reopen the plugin.
- **Default coin pool** — Expanded to 50 popular tokens, including **ETH**.
- **Footer** — Support link updated to [Buy me a coffee](https://buymeacoffee.com/desktopofsamuel).
- **Community assets** — Plugin icon (`assets/icon.png`, 128×128) ready for Figma Community publishing.
