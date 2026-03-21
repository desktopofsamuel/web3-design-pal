# Web3 Design Pal

A Figma plugin that generates mock cryptocurrency wallet addresses for UI and marketing work—so you can fill frames and text layers with plausible strings without using real keys or hitting any network.

## What it does

- **Pick a chain-style format**: Ethereum (`0x…` hex), Solana (base58-style), Bitcoin (`bc1…`-style), or XRP-style strings.
- **Preview**: See a generated address in the plugin panel; use **Refresh** to roll another mock value.
- **Optional truncation**: Shorten the preview (and what gets created or applied) for cramped layouts.
- **Create / Apply**: The primary button is **Create** when you’re adding new text (no selection or empty frame/group/section); **Apply** when replacing existing text. It writes to the canvas depending on selection:
  - Nothing selected → new text on the page.
  - Empty frames/groups → text inside those containers.
  - One or more text layers → replaces text; multiple layers get **different** mock addresses per layer.

Addresses are **syntactically styled** for design, not cryptographically valid or safe to use as real wallets.

## Platform support

| Where it runs | Notes |
|---------------|--------|
| **Figma** | Primary editor; load the plugin from **Plugins → Development** after building. |
| **FigJam**, **Figma Slides**, **Buzz** | Same plugin bundle is enabled for these editor types in [`manifest.json`](manifest.json) (`editorType`). Availability matches wherever Figma exposes plugins for that surface. |

Requirements:

- **Figma desktop** (or the supported Figma product that runs plugins for your account).
- This project declares **`networkAccess`: `none`**—generation is **local** only; no RPC or external APIs.

Official plugin intro: [Figma Plugin Quickstart](https://www.figma.com/plugin-docs/plugin-quickstart-guide/).

---

## Development

The main thread is **TypeScript** ([`code.ts`](code.ts)) compiled to [`code.js`](code.js). The UI is [`ui.html`](ui.html) (plain HTML + inline script).

1. Install [Node.js](https://nodejs.org/) (includes corepack/npm; this repo uses **pnpm**).
2. From the project directory:

   ```bash
   pnpm install
   pnpm run build
   ```

   - `pnpm run build` — emit `code.js` from `code.ts`
   - `pnpm run typecheck` — TypeScript check only
   - `pnpm run lint` — ESLint

3. In Figma: **Plugins → Development → Import plugin from manifest…** and choose this folder’s `manifest.json`.

Optional: use **Plugins → Development → Open Console** while testing.

## Plugin UI tests (Playwright)

Tests serve [`ui.html`](ui.html) over HTTP and check the DOM plus `postMessage` payloads (they do **not** execute the Figma main thread in [`code.ts`](code.ts)).

```bash
pnpm install
pnpm exec playwright install chromium   # once
pnpm run test:e2e                       # or: pnpm run test:e2e:ui
```

On **GitHub**, pushes and PRs to `main` / `master` run the same suite via [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml) (Chromium + `serve`; artifacts upload on failure).

## Development
In order to make this plugin run, ensure that you do all of these steps!

**Download these files**

- Download the files instead of checking them out

**Building files**

    $ npm install
    $ npx webpack --watch

**Testing in Figma**

The main settings for your plugin are located in the `manifest.json` file. Make sure to add the name of your plugin and  Make sure In order to add this plugin for testing in Figma:

- Open the Figma desktop app (plugin development doesn't work on Figma web)
- Navigate to the Plugins tab in the left sidebar
- Click 'Create your own plugin' on the right
- Click the 'Click to choose a manifest.json file' and navigate to the `dist/manifest.json` file in the **`dist`** folder of your plugin (Ensure that you don't select the `manifest.json` file in the root directory of your plugin!)

In order to save to local storage, you'll need to genarate a plugin ID:

- Right click the plugin you just added and click "Publish new release" (don't worry, we won't publish yet)
- Scroll down to 'Identifier' and click the 'Generate ID' button
- Copy the generated ID to your `manifest.json`

To run the plugin:

- Open a Figma file
- Right click to open menu, navigate to Plugins -> Development -> Your Plugin
- You can see the console for errors and logs underneath Plugins -> Development -> Open Console
- You can quickly re-run the last plugin with ALT+CMD+P


## Publishing

**Building files**

    $ NODE_ENV=production npx webpack

**Publish new release**

When you're ready to publish, you can publish the plugin to either your organization only or open to everyone.

- Open Figma desktop app
- Navigate to Plugins tab in the left sidebar
- Under 'Development' on the right, right-click the plugin and click 'Publish new release'
- In the following modal, enter the icon, preview artwork, and description for the plugin then whether to publish for just your organization or for the public
- 🥂


Web3 Design Pal
Your friendly helper for your Web3 design

A Figma plugin that generates mock cryptocurrency wallet addresses for UI and marketing work—so you can fill frames and text layers with plausible strings without using real keys or hitting any network.