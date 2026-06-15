import { expect, test } from '@playwright/test';
import { DEFAULT_PRICE_COINS, DEFAULT_PRICE_COINS_TEXT } from '../../src/constants';

const STORAGE_KEY = 'web3dpal_truncate_rules';
const PRICE_CACHE_KEY = 'web3dpal_price_cache';
const PRICE_COINS_KEY = 'web3dpal_price_coins';
const BUY_ME_COFFEE_URL = 'https://buymeacoffee.com/desktopofsamuel';
const PROFILE_URL = 'https://desktopofsamuel.com';
const ethLine = /^0x[a-f0-9]{40}$/;
/** Base58 alphabet (no 0 O I l) */
const solPattern = /^[1-9A-HJ-NP-Za-km-z]{44}$/;

// ─── Price tab mock data (real CoinGecko response, 2024-04) ──────────────────
const MOCK_COINS: Record<string, { price: number; change: number; volume: number; mcap: number; vs?: Record<string, { price: number; change: number; volume: number; mcap: number }> }> =
  {
    ETH: {
      price: 2279.4,
      change: -1.7090294198921991,
      volume: 13619093866.416811,
      mcap: 275124785372.0594,
      vs: {
        aud: {
          price: 4730.12,
          change: -1.1,
          volume: 2.1e9,
          mcap: 5.6e10,
        },
      },
    },
    BTC: {
      price: 76511,
      change: -1.6369118028497176,
      volume: 33915634645.395718,
      mcap: 1532118888510.001,
      vs: {
        aud: {
          price: 118234.56,
          change: -1.2,
          volume: 5.1e10,
          mcap: 2.35e12,
        },
      },
    },
    SOL: {
      price: 83.71,
      change: -1.6606195765535383,
      volume: 2891995107.941362,
      mcap: 48236128508.15029,
      vs: {
        aud: {
          price: 116.25,
          change: -1.3,
          volume: 1.9e8,
          mcap: 4.9e9,
        },
      },
    },
    XRP: {
      price: 1.39,
      change: -1.9317122850842732,
      volume: 1849986074.768185,
      mcap: 85569581780.77618,
      vs: {
        aud: {
          price: 1.43,
          change: -0.4,
          volume: 1.1e8,
          mcap: 7.2e9,
        },
      },
    },
    USDT: {
      price: 1.0,
      change: 0.01,
      volume: 4.5e10,
      mcap: 9.5e10,
      vs: {
        aud: {
          price: 1.51,
          change: 0,
          volume: 3.3e9,
          mcap: 1.1e10,
        },
      },
    },
    USDC: {
      price: 1.0,
      change: 0,
      volume: 3.2e9,
      mcap: 3.2e10,
      vs: {
        aud: {
          price: 1.4012,
          change: 0,
          volume: 2.1e8,
          mcap: 1.05e9,
        },
      },
    },
    BNB: {
      price: 622.29,
      change: -0.759411015015047,
      volume: 846504885.6417747,
      mcap: 83868252775.19609,
    },
  };

/**
 * Figma GRID table: two data rows in one frame, each with {crypto}/{price}/{change}.
 * Scan groups by row so each grid row becomes its own card (not one merged card).
 */
const MOCK_CARDS_FIGMA_GRID_TABLE = [
  {
    cardName: 'Row 1',
    matches: [
      { nodeId: 'grid-r1-c', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
      { nodeId: 'grid-r1-p', layerName: '{price}', currentText: '{price}', role: 'price' },
      { nodeId: 'grid-r1-ch', layerName: '{change}', currentText: '{change}', role: 'change' },
    ],
  },
  {
    cardName: 'Row 2',
    matches: [
      { nodeId: 'grid-r2-c', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
      { nodeId: 'grid-r2-p', layerName: '{price}', currentText: '{price}', role: 'price' },
      { nodeId: 'grid-r2-ch', layerName: '{change}', currentText: '{change}', role: 'change' },
    ],
  },
];

/** Reusable mock cards — two token cards each with a {crypto} + {price} layer. */
const MOCK_CARDS = [
  {
    cardName: 'Token Card 1',
    matches: [
      { nodeId: 'n1', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
      { nodeId: 'n2', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'Token Card 2',
    matches: [
      { nodeId: 'n3', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
      { nodeId: 'n4', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
];

/**
 * Auto-detect mock cards: ticker text is already set ("BTC", "ETH") rather
 * than a placeholder. The `isLiteral` flag means the ticker layer is NOT
 * replaced — only sibling data layers ({price}, {change}) are updated.
 */
const MOCK_CARDS_AUTO_DETECT = [
  {
    cardName: 'BTC Row',
    matches: [
      { nodeId: 'a1', layerName: 'ticker', currentText: 'BTC', role: 'crypto', isLiteral: true },
      { nodeId: 'a2', layerName: '{price}', currentText: '{price}', role: 'price' },
      { nodeId: 'a3', layerName: '{change}', currentText: '{change}', role: 'change' },
    ],
  },
  {
    cardName: 'ETH Row',
    matches: [
      { nodeId: 'b1', layerName: 'ticker', currentText: 'ETH', role: 'crypto', isLiteral: true },
      { nodeId: 'b2', layerName: '{price}', currentText: '{price}', role: 'price' },
      { nodeId: 'b3', layerName: '{change}', currentText: '{change}', role: 'change' },
    ],
  },
];

/** Simulates scan output for BTC/AUD variants (same as plugin would emit). */
const MOCK_CARDS_FIAT_PAIR_VARIANTS = [
  {
    cardName: 'Slash',
    matches: [
      {
        nodeId: 'fp1',
        layerName: 'pair',
        currentText: 'BTC/AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'BTC',
        vsCurrency: 'aud',
      },
      { nodeId: 'fp1p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'Spaced',
    matches: [
      {
        nodeId: 'fp2',
        layerName: 'pair',
        currentText: 'BTC / AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'BTC',
        vsCurrency: 'aud',
      },
      { nodeId: 'fp2p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'Concat',
    matches: [
      {
        nodeId: 'fp3',
        layerName: 'pair',
        currentText: 'BTCAUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'BTC',
        vsCurrency: 'aud',
      },
      { nodeId: 'fp3p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'UsdOnly',
    matches: [
      { nodeId: 'fp4', layerName: 'ticker', currentText: 'BTC', role: 'crypto', isLiteral: true },
      { nodeId: 'fp4p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
];

/**
 * Crypto Landing Page–style rows: pair label + sibling text layer named `{price}`
 * (content `{price}`), as after renaming the bid cell for plugin updates.
 * Spacing variants match the Figma file (slash with spaces, space after slash only, tight XRP/AUD).
 */
const MOCK_CARDS_FIGMA_LANDING_PAIR_ROWS = [
  {
    cardName: 'BTC / AUD',
    matches: [
      {
        nodeId: 'fl-btc-c',
        layerName: 'pair',
        currentText: 'BTC / AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'BTC',
        vsCurrency: 'aud',
      },
      { nodeId: 'fl-btc-p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'ETH / AUD',
    matches: [
      {
        nodeId: 'fl-eth-c',
        layerName: 'pair',
        currentText: 'ETH / AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'ETH',
        vsCurrency: 'aud',
      },
      { nodeId: 'fl-eth-p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'USDT/ AUD',
    matches: [
      {
        nodeId: 'fl-usdt-c',
        layerName: 'pair',
        currentText: 'USDT/ AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'USDT',
        vsCurrency: 'aud',
      },
      { nodeId: 'fl-usdt-p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'USDC/ AUD',
    matches: [
      {
        nodeId: 'fl-usdc-c',
        layerName: 'pair',
        currentText: 'USDC/ AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'USDC',
        vsCurrency: 'aud',
      },
      { nodeId: 'fl-usdc-p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'SOL / AUD',
    matches: [
      {
        nodeId: 'fl-sol-c',
        layerName: 'pair',
        currentText: 'SOL / AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'SOL',
        vsCurrency: 'aud',
      },
      { nodeId: 'fl-sol-p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
  {
    cardName: 'XRP/AUD',
    matches: [
      {
        nodeId: 'fl-xrp-c',
        layerName: 'pair',
        currentText: 'XRP/AUD',
        role: 'crypto',
        isLiteral: true,
        quoteSymbol: 'XRP',
        vsCurrency: 'aud',
      },
      { nodeId: 'fl-xrp-p', layerName: '{price}', currentText: '{price}', role: 'price' },
    ],
  },
];

async function firstPreviewText(page: import('@playwright/test').Page): Promise<string> {
  const line = page.locator('#preview-inner .preview-line').first();
  return (await line.textContent()) ?? '';
}

function postSelectionContext(
  page: import('@playwright/test').Page,
  payload: Record<string, unknown>,
): Promise<void> {
  return page.evaluate((body) => {
    window.postMessage({ pluginMessage: body }, '*');
  }, payload);
}

/**
 * UI reads/writes truncate rules via postMessage; Figma satisfies that with
 * figma.clientStorage. In the browser harness, emulate the main thread and
 * optionally mirror to localStorage so tests can reset state.
 */
async function installFigmaStorageMock(
  page: import('@playwright/test').Page,
  coins: Record<
    string,
    {
      price: number;
      change: number;
      volume: number;
      mcap: number;
      vs?: Record<string, { price: number; change: number; volume: number; mcap: number }>;
    }
  > = {},
): Promise<void> {
  await page.addInitScript(
    (cfg: {
      key: string;
      priceKey: string;
      priceCoinsKey: string;
      defaultPriceCoins: string;
      buy: string;
      profile: string;
      coins: Record<
        string,
        {
          price: number;
          change: number;
          volume: number;
          mcap: number;
          vs?: Record<string, { price: number; change: number; volume: number; mcap: number }>;
        }
      >;
    }) => {
      window.addEventListener('message', (ev: MessageEvent) => {
        const pm = (ev.data as { pluginMessage?: Record<string, unknown> } | undefined)
          ?.pluginMessage;
        if (!pm || typeof pm !== 'object') return;
        const type = pm.type as string;

        if (type === 'get-truncate-rules') {
          let start = 6;
          let end = 4;
          try {
            const raw = localStorage.getItem(cfg.key);
            if (raw) {
              const p = JSON.parse(raw) as { start?: unknown; end?: unknown };
              start = Math.max(0, Math.min(64, Math.floor(Number(p.start) || 6)));
              end = Math.max(0, Math.min(64, Math.floor(Number(p.end) || 4)));
            }
          } catch {
            /* use defaults */
          }
          window.postMessage({ pluginMessage: { type: 'truncate-rules', start, end } }, '*');
        }

        if (type === 'get-footer-links') {
          window.postMessage(
            {
              pluginMessage: {
                type: 'footer-links',
                buyMeCoffeeUrl: cfg.buy,
                profileUrl: cfg.profile,
              },
            },
            '*',
          );
        }

        if (type === 'save-truncate-rules') {
          const start = Math.max(0, Math.min(64, Math.floor(Number(pm.start) || 6)));
          const end = Math.max(0, Math.min(64, Math.floor(Number(pm.end) || 4)));
          try {
            localStorage.setItem(cfg.key, JSON.stringify({ start, end }));
          } catch {
            /* ignore */
          }
          window.postMessage({ pluginMessage: { type: 'truncate-rules', start, end } }, '*');
        }

        if (type === 'get-api-keys') {
          let cgKey = '';
          let cmcKey = '';
          try {
            const raw = localStorage.getItem('web3dpal_api_keys');
            if (raw) {
              const p = JSON.parse(raw) as { cgKey?: string; cmcKey?: string };
              cgKey = typeof p.cgKey === 'string' ? p.cgKey : '';
              cmcKey = typeof p.cmcKey === 'string' ? p.cmcKey : '';
            }
          } catch {
            /* ignore */
          }
          window.postMessage(
            { pluginMessage: { type: 'api-keys', coingeckoKey: cgKey, cmcKey } },
            '*',
          );
        }

        if (type === 'save-api-keys') {
          try {
            localStorage.setItem(
              'web3dpal_api_keys',
              JSON.stringify({ cgKey: pm.coingeckoKey ?? '', cmcKey: pm.cmcKey ?? '' }),
            );
          } catch {
            /* ignore */
          }
        }

        if (type === 'get-price-coins') {
          let coinsText = cfg.defaultPriceCoins;
          try {
            const raw = localStorage.getItem(cfg.priceCoinsKey);
            if (raw && raw.trim()) coinsText = raw.trim();
          } catch {
            /* use default */
          }
          window.postMessage({ pluginMessage: { type: 'price-coins', coins: coinsText } }, '*');
        }

        if (type === 'save-price-coins') {
          const coinsText = typeof pm.coins === 'string' ? pm.coins : cfg.defaultPriceCoins;
          try {
            localStorage.setItem(cfg.priceCoinsKey, coinsText);
          } catch {
            /* ignore */
          }
          window.postMessage({ pluginMessage: { type: 'price-coins', coins: coinsText } }, '*');
        }

        // Respond to fetch-prices with the baked-in mock coin data.
        if (type === 'fetch-prices') {
          window.postMessage(
            { pluginMessage: { type: 'prices-result', source: 'coingecko', coins: cfg.coins } },
            '*',
          );
        }

        // resize-ui is a no-op in browser tests (iframe resize not available).
        if (type === 'resize-ui') { /* no-op */ }
      });

      // Pre-populate price cache so scan results can immediately enable the apply button
      // without needing a Refresh click (mirrors real usage where user already refreshed).
      if (Object.keys(cfg.coins).length > 0) {
        try {
          localStorage.setItem(cfg.priceKey, JSON.stringify({
            coins: cfg.coins, source: 'coingecko', timestamp: Date.now(),
          }));
        } catch (_) {}
      }
    },
    { key: STORAGE_KEY, priceKey: PRICE_CACHE_KEY, priceCoinsKey: PRICE_COINS_KEY, defaultPriceCoins: DEFAULT_PRICE_COINS_TEXT, buy: BUY_ME_COFFEE_URL, profile: PROFILE_URL, coins },
  );
}

test.describe('Web3 Design Pal UI', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page, MOCK_COINS);
    await page.goto('/ui.html');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.reload();
  });

  test('Ethereum preview on load', async ({ page }) => {
    const text = await firstPreviewText(page);
    expect(text).toMatch(ethLine);
  });

  test('default primary action is Create (no selection-context yet)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  });

  test('network chips are ordered Ethereum, Bitcoin, Solana, Ripple', async ({ page }) => {
    await expect(page.locator('#chips .chip')).toHaveText([
      'Ethereum',
      'Bitcoin',
      'Solana',
      'Ripple',
    ]);
  });

  test('top nav tabs are ordered Address, Price, TxID', async ({ page }) => {
    await expect(page.locator('.segment [role="tab"]')).toHaveText(['Address', 'Price', 'TxID']);
  });

  test('footer links are valid and point to expected URLs', async ({ page }) => {
    await expect(page.locator('#link-buy-me-coffee')).toHaveAttribute('href', BUY_ME_COFFEE_URL);
    await expect(page.locator('#link-profile')).toHaveAttribute('href', PROFILE_URL);
  });

  test('TxID tab shows coming soon empty state', async ({ page }) => {
    await page.getByRole('tab', { name: 'TxID' }).click();
    await expect(page.getByText('Coming soon')).toBeVisible();
    await expect(
      page.getByText('Transaction ID tools will be available in a future update.'),
    ).toBeVisible();
    await expect(page.locator('#view-wallet')).toHaveClass(/view-hidden/);
  });

  test('Settings view scrolls inside fixed content area', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();

    const metrics = await page.evaluate(() => {
      const c = document.querySelector('.content-below-header') as HTMLElement | null;
      if (!c) return null;
      const overflowY = window.getComputedStyle(c).overflowY;
      const before = c.scrollTop;
      c.scrollTop = 9999;
      return {
        before,
        after: c.scrollTop,
        scrollHeight: c.scrollHeight,
        clientHeight: c.clientHeight,
        overflowY,
      };
    });

    expect(metrics).not.toBeNull();
    expect(metrics!.overflowY).toBe('auto');
    expect(metrics!.scrollHeight).toBeGreaterThanOrEqual(metrics!.clientHeight);
    if (metrics!.scrollHeight > metrics!.clientHeight) {
      expect(metrics!.after).toBeGreaterThan(metrics!.before);
    }
  });

  test('Solana chip updates preview', async ({ page }) => {
    await page.getByRole('button', { name: 'Solana' }).click();
    const text = await firstPreviewText(page);
    expect(text).toMatch(solPattern);
  });

  test('Refresh changes preview', async ({ page }) => {
    const before = await firstPreviewText(page);
    await page.getByRole('button', { name: 'Refresh' }).click();
    const after = await firstPreviewText(page);
    expect(after).not.toBe(before);
    expect(after).toMatch(ethLine);
  });

  test('Truncation shortens preview and Create posts apply with truncate + rule fields', async ({
    page,
  }) => {
    await page.locator('#truncate').check();
    const text = await firstPreviewText(page);
    expect(text).toContain('...');
    expect(text.length).toBeLessThan(42);

    await page.evaluate(() => {
      const w = window as unknown as { __applyCapture: Record<string, unknown> | null };
      w.__applyCapture = null;
      const handler = (e: Event): void => {
        const ev = e as MessageEvent;
        const pm = ev.data?.pluginMessage as { type?: string } | undefined;
        if (pm?.type === 'apply') {
          w.__applyCapture = pm as Record<string, unknown>;
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
    });

    await page.getByRole('button', { name: 'Create' }).click();
    const captured = await page.evaluate(() => {
      const w = window as unknown as { __applyCapture: Record<string, unknown> | null };
      return w.__applyCapture;
    });
    expect(captured).not.toBeNull();
    const msg = captured!;

    expect(msg.type).toBe('apply');
    expect(msg.truncate).toBe(true);
    expect(msg.truncateStart).toBe(6);
    expect(msg.truncateEnd).toBe(4);
    expect(msg.network).toBe('Ethereum');
    expect(typeof msg.previewAddress).toBe('string');
    expect((msg.previewAddress as string).startsWith('0x')).toBe(true);
    expect(msg.previewAddress).not.toContain('...');
  });

  test('settings save updates truncate preview and apply payload', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByLabel('Characters at start')).toHaveValue('6');
    await expect(page.getByLabel('Characters at end')).toHaveValue('4');
    await page.getByLabel('Characters at start').fill('4');
    await page.getByLabel('Characters at end').fill('2');
    await page.locator('#settings-save').click();
    await expect(page.locator('#view-wallet')).toBeVisible();
    await expect(page.locator('#view-settings')).toBeHidden();

    await page.locator('#truncate').check();
    const text = await firstPreviewText(page);
    /* start=4 counts raw chars: "0x" + two hex from example */
    expect(text).toMatch(/^0x[0-9a-f]{2}\.\.\.[0-9a-f]{2}$/);

    await page.evaluate(() => {
      const w = window as unknown as { __applyCapture: Record<string, unknown> | null };
      w.__applyCapture = null;
      const handler = (e: Event): void => {
        const ev = e as MessageEvent;
        const pm = ev.data?.pluginMessage as { type?: string } | undefined;
        if (pm?.type === 'apply') {
          w.__applyCapture = pm as Record<string, unknown>;
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
    });

    await page.getByRole('button', { name: 'Create' }).click();
    const captured = await page.evaluate(() => {
      const w = window as unknown as { __applyCapture: Record<string, unknown> | null };
      return w.__applyCapture;
    });
    expect(captured).not.toBeNull();
    expect(captured!.truncateStart).toBe(4);
    expect(captured!.truncateEnd).toBe(2);
  });

  test('Create posts apply payload without truncation', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __applyCapture: Record<string, unknown> | null };
      w.__applyCapture = null;
      const handler = (e: Event): void => {
        const ev = e as MessageEvent;
        const pm = ev.data?.pluginMessage as { type?: string } | undefined;
        if (pm?.type === 'apply') {
          w.__applyCapture = pm as Record<string, unknown>;
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
    });

    await page.getByRole('button', { name: 'Create' }).click();
    const captured = await page.evaluate(() => {
      const w = window as unknown as { __applyCapture: Record<string, unknown> | null };
      return w.__applyCapture;
    });
    expect(captured).not.toBeNull();
    const msg = captured!;

    expect(msg.type).toBe('apply');
    expect(msg.truncate).toBe(false);
    expect(msg.truncateStart).toBe(6);
    expect(msg.truncateEnd).toBe(4);
    expect(msg.network).toBe('Ethereum');
    expect(msg.previewAddress).toMatch(ethLine);
  });

  test('create-in-frame context keeps Create label and hint', async ({ page }) => {
    await postSelectionContext(page, {
      type: 'selection-context',
      mode: 'create-in-frame',
      textTargetCount: 0,
      previewBatchSize: 2,
    });

    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
    await expect(page.locator('#hint')).toHaveText(
      'Create adds text inside each selected frame or group.',
    );
  });

  test('retext-one context shows Apply label and hint', async ({ page }) => {
    await postSelectionContext(page, {
      type: 'selection-context',
      mode: 'retext-one',
      textTargetCount: 1,
      previewBatchSize: 1,
    });

    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();
    await expect(page.locator('#hint-line')).toBeHidden();
    await expect(page.locator('#hint')).toHaveText(
      'Apply updates 1 text layer with the preview address.',
    );
  });

  test('selection-context retext-many shows five lines and "10 more..."', async ({ page }) => {
    await postSelectionContext(page, {
      type: 'selection-context',
      mode: 'retext-many',
      textTargetCount: 15,
      previewBatchSize: 15,
    });

    await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();

    const lines = page.locator('#preview-inner .preview-line');
    await expect(lines).toHaveCount(5);

    const more = page.locator('#preview-inner .preview-more');
    await expect(more).toHaveText('10 more...');

    for (let i = 0; i < 5; i++) {
      const t = await lines.nth(i).textContent();
      expect(t).toMatch(ethLine);
    }
  });
});

test.describe('Truncate settings page', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page, MOCK_COINS);
    await page.goto('/ui.html');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.reload();
  });

  test('opens with heading, copy, Save, and default start 6 / end 4', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.locator('#view-settings')).toBeVisible();
    await expect(page.locator('#view-wallet')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Truncate rules' })).toBeVisible();
    await expect(
      page.getByText(/character counts from the start and end of the address/i),
    ).toBeVisible();

    await expect(page.getByLabel('Characters at start')).toBeVisible();
    await expect(page.getByLabel('Characters at end')).toBeVisible();
    await expect(page.getByLabel('Characters at start')).toHaveValue('6');
    await expect(page.getByLabel('Characters at end')).toHaveValue('4');

    await expect(page.locator('#settings-save')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0);
  });

  test('save sends save-truncate-rules with start/end, toast, and closes settings', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __saveRulesMsgs: Record<string, unknown>[] };
      w.__saveRulesMsgs = [];
      const handler = (e: Event): void => {
        const ev = e as MessageEvent;
        const pm = ev.data?.pluginMessage as { type?: string } | undefined;
        if (pm?.type === 'save-truncate-rules') {
          w.__saveRulesMsgs.push(pm as Record<string, unknown>);
        }
      };
      window.addEventListener('message', handler);
    });

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Characters at start').fill('8');
    await page.getByLabel('Characters at end').fill('10');
    await page.locator('#settings-save').click();

    const msgs = await page.evaluate(() => {
      const w = window as unknown as { __saveRulesMsgs: Record<string, unknown>[] };
      return w.__saveRulesMsgs;
    });
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    const last = msgs[msgs.length - 1];
    expect(last.type).toBe('save-truncate-rules');
    expect(last.start).toBe(8);
    expect(last.end).toBe(10);

    await expect(page.locator('#toast')).toContainText('Truncate rules saved');
    await expect(page.locator('#view-settings')).toBeHidden();
    await expect(page.locator('#view-wallet')).toBeVisible();
  });

  test('save clamps start/end to 0–64 in save-truncate-rules message', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __saveRulesMsgs: Record<string, unknown>[] };
      w.__saveRulesMsgs = [];
      window.addEventListener('message', (e: Event) => {
        const ev = e as MessageEvent;
        const pm = ev.data?.pluginMessage as { type?: string } | undefined;
        if (pm?.type === 'save-truncate-rules') {
          w.__saveRulesMsgs.push(pm as Record<string, unknown>);
        }
      });
    });

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Characters at start').fill('200');
    await page.getByLabel('Characters at end').fill('-3');
    await page.locator('#settings-save').click();

    const last = await page.evaluate(() => {
      const w = window as unknown as { __saveRulesMsgs: Record<string, unknown>[] };
      return w.__saveRulesMsgs[w.__saveRulesMsgs.length - 1];
    });
    expect(last.start).toBe(64);
    expect(last.end).toBe(0);
  });

  test('switching tabs after editing settings shows unsaved toast and returns to wallet', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Characters at start').fill('9');
    await page.getByRole('tab', { name: 'Address' }).click();

    await expect(page.locator('#toast')).toContainText('Changes were not saved.');
    await expect(page.locator('#view-wallet')).toBeVisible();
    await expect(page.getByLabel('Characters at start')).not.toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByLabel('Characters at start')).toHaveValue('6');
  });
});

// ─── Helpers shared by price tests ───────────────────────────────────────────

/** Navigate to the Price tab. */
async function openPriceTab(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('tab', { name: 'Price' }).click();
}

/**
 * Simulate the main thread replying to a scan-price-layers call with the given
 * cards, then wait for the summary element to become visible.
 */
async function postScanResult(
  page: import('@playwright/test').Page,
  cards: typeof MOCK_CARDS,
): Promise<void> {
  await postSelectionContext(page, { type: 'price-layer-scan', cards });
  await page.locator('#price-scan-summary').waitFor({ state: 'visible' });
}

/** Count trailing K/M/B/T from formatLarge — must stay at 1 after re-apply (regression: no "BB"). */
function trailingLargeSuffixLength(text: string): number {
  const m = text.match(/[kKmMbBtT]+$/);
  return m ? m[0].length : 0;
}

function assertNoAccumulatedLargeSuffix(text: string): void {
  expect(trailingLargeSuffixLength(text)).toBeLessThanOrEqual(1);
  expect(text).not.toMatch(/[kKmMbBtT]{2,}$/);
}

async function clickApplyPriceAndCapture(
  page: import('@playwright/test').Page,
): Promise<Array<{ nodeId: string; newText: string }>> {
  await page.evaluate(() => {
    const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
    w.__applyPriceCapture = null;
    window.addEventListener('message', function handler(e: Event) {
      const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
      if (pm?.type === 'apply-price') {
        w.__applyPriceCapture = pm;
        window.removeEventListener('message', handler);
      }
    });
  });

  await page.locator('#price-apply-btn').click();

  const msg = await page.evaluate(
    () =>
      (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
        .__applyPriceCapture,
  );
  expect(msg).not.toBeNull();
  return msg!.replacements as Array<{ nodeId: string; newText: string }>;
}

/**
 * Full happy-path setup: navigate to Price tab, post a scan result, and wait
 * for the apply button to become enabled. Prices are pre-loaded from the
 * localStorage cache seeded by installFigmaStorageMock, so no Refresh click
 * is needed here.
 */
async function setupPriceTabWithData(
  page: import('@playwright/test').Page,
  cards: typeof MOCK_CARDS = MOCK_CARDS,
): Promise<void> {
  await openPriceTab(page);
  await postScanResult(page, cards);
  await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });
}

// ─── Price tab tests ──────────────────────────────────────────────────────────

test.describe('Price tab', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page, MOCK_COINS);
    await page.goto('/ui.html');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.setItem('web3dpal_api_keys', JSON.stringify({ cgKey: 'CG-testkey', cmcKey: '' }));
    }, STORAGE_KEY);
    await page.reload();
  });

  test('Price tab is shown and Address tab is hidden when Price tab is clicked', async ({
    page,
  }) => {
    await openPriceTab(page);
    await expect(page.locator('#view-price')).toBeVisible();
    await expect(page.locator('#view-wallet')).toHaveClass(/view-hidden/);
  });

  test('default coin textarea contains 50 popular tokens including ETH', async ({ page }) => {
    await openPriceTab(page);
    await page.waitForFunction(() => {
      const el = document.getElementById('price-coin-input') as HTMLTextAreaElement | null;
      return el != null && el.value.includes('ETH');
    });
    const value = await page.locator('#price-coin-input').inputValue();
    const coins = value.split(',').map((s) => s.trim());
    expect(coins).toContain('ETH');
    expect(coins).toContain('BTC');
    expect(coins).toContain('SOL');
    expect(coins.length).toBe(DEFAULT_PRICE_COINS.length);
  });

  test('coin textarea persists across reload', async ({ page }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('DOGE, SHIB, PEPE');
    await page.waitForTimeout(400);
    await page.reload();
    await openPriceTab(page);
    await page.waitForFunction(() => {
      const el = document.getElementById('price-coin-input') as HTMLTextAreaElement | null;
      return el != null && el.value.includes('DOGE');
    });
    const value = await page.locator('#price-coin-input').inputValue();
    expect(value).toContain('DOGE');
    expect(value).toContain('SHIB');
    expect(value).not.toContain('ETH');
  });

  test('before any scan, Update text is disabled and no-selection hint is shown', async ({
    page,
  }) => {
    await openPriceTab(page);
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
    await expect(page.locator('#price-no-selection')).toBeVisible();
  });

  test('Scan button posts scan-price-layers with correct default variable names', async ({
    page,
  }) => {
    await openPriceTab(page);

    // Set up listener first (returns void — no deadlock).
    await page.evaluate(() => {
      const w = window as unknown as { __scanCapture: Record<string, unknown> | null };
      w.__scanCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'scan-price-layers') {
          w.__scanCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.getByRole('button', { name: 'Scan' }).click();

    // Poll for the captured value (click triggers the postMessage synchronously).
    const msg = await page.evaluate(
      () => (window as unknown as { __scanCapture: Record<string, unknown> | null }).__scanCapture,
    );

    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('scan-price-layers');
    expect(msg!.cryptoVar).toBe('{crypto}');
    expect(msg!.priceVar).toBe('{price}');
    expect(msg!.changeVar).toBe('{change}');
    expect(msg!.volumeVar).toBe('{volume}');
    expect(msg!.mcapVar).toBe('{mcap}');
    // knownTickers must be sent — it drives literal-ticker auto-detection in code.ts
    expect(Array.isArray(msg!.knownTickers)).toBe(true);
    expect((msg!.knownTickers as string[]).length).toBeGreaterThan(0);
  });

  test('duplicate coins in textarea shows error toast and blocks scan request', async ({ page }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH, BTC, ETH');
    await page.evaluate(() => {
      const w = window as unknown as { __scanCapture: Record<string, unknown> | null };
      w.__scanCapture = null;
      window.addEventListener('message', (e: Event) => {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'scan-price-layers') w.__scanCapture = pm;
      });
    });

    await page.getByRole('button', { name: 'Scan' }).click();
    await expect(page.locator('#toast')).toContainText(
      'Duplicate coins found: ETH. Remove duplicates and try again.',
    );
    const captured = await page.evaluate(
      () => (window as unknown as { __scanCapture: Record<string, unknown> | null }).__scanCapture,
    );
    expect(captured).toBeNull();
  });

  test('price-layer-scan with 2 cards shows card count in summary', async ({ page }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS);
    await expect(page.locator('#price-scan-summary')).toContainText('2 cards');
  });

  test('price-layer-scan with empty cards shows "No matching layer names" message', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postSelectionContext(page, { type: 'price-layer-scan', cards: [] });
    await expect(page.locator('#price-no-selection')).toContainText(
      'No matching layer names found in selection.',
    );
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('Update text disables again when a later scan returns no matching layer names', async ({
    page,
  }) => {
    await setupPriceTabWithData(page);
    await expect(page.locator('#price-apply-btn')).toBeEnabled();

    await postSelectionContext(page, { type: 'price-layer-scan', cards: [] });
    await expect(page.locator('#price-no-selection')).toContainText(
      'No matching layer names found in selection.',
    );
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('after prices load, summary says Ready to update and Update text is enabled', async ({
    page,
  }) => {
    await setupPriceTabWithData(page);
    await expect(page.locator('#price-scan-summary')).toContainText('Ready to update');
    await expect(page.locator('#price-apply-btn')).toBeEnabled();
  });

  test('selection change clears stale scan and disables Update text until re-scan', async ({
    page,
  }) => {
    await setupPriceTabWithData(page);
    await expect(page.locator('#price-apply-btn')).toBeEnabled();

    await postSelectionContext(page, {
      type: 'selection-context',
      mode: 'create-on-page',
      textTargetCount: 0,
      previewBatchSize: 0,
    });

    await expect(page.locator('#price-no-selection')).toContainText(
      'No frame or group selected in Figma.',
    );
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('source banner appears and names CoinGecko after prices load', async ({ page }) => {
    await setupPriceTabWithData(page);
    await expect(page.locator('#price-source-banner')).toBeVisible();
    await expect(page.locator('#price-source-banner')).toContainText('CoinGecko');
  });

  test('Refresh button is visible in Price tab', async ({ page }) => {
    await openPriceTab(page);
    await expect(page.locator('#price-refresh-btn')).toBeVisible();
  });

  test('Refresh button posts fetch-prices message', async ({ page }) => {
    await openPriceTab(page);
    await page.evaluate(() => {
      const w = window as unknown as { __fetchCapture: Record<string, unknown> | null };
      w.__fetchCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'fetch-prices') {
          w.__fetchCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });
    await page.locator('#price-refresh-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __fetchCapture: Record<string, unknown> | null }).__fetchCapture,
    );
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('fetch-prices');
    expect(Array.isArray(msg!.symbols)).toBe(true);
  });

  test('Refresh shows persistent yellow callout and does not post fetch-prices when no API key is set', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('web3dpal_api_keys', JSON.stringify({ cgKey: '', cmcKey: '' }));
    });
    await page.reload();
    await openPriceTab(page);
    await page.evaluate(() => {
      const w = window as unknown as { __fetchCapture: Record<string, unknown> | null };
      w.__fetchCapture = null;
      window.addEventListener('message', (e: Event) => {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'fetch-prices') w.__fetchCapture = pm;
      });
    });
    await page.locator('#price-refresh-btn').click();
    await expect(page.locator('#price-source-banner')).toBeVisible();
    await expect(page.locator('#price-source-banner')).toContainText(
      'Set your API key in Settings first, then refresh prices.',
    );
    const captured = await page.evaluate(
      () => (window as unknown as { __fetchCapture: Record<string, unknown> | null }).__fetchCapture,
    );
    expect(captured).toBeNull();
  });

  test('timestamp is shown when prices are cached in localStorage', async ({ page }) => {
    // installFigmaStorageMock pre-seeds the price cache; loadPriceCache() runs on init.
    await openPriceTab(page);
    await expect(page.locator('#price-timestamp')).toBeVisible();
    const text = await page.locator('#price-timestamp').textContent();
    expect(text).toMatch(/Prices updated/);
  });

  test('needs-refresh clears when unknown coin is removed from textarea', async ({ page }) => {
    // MOCK_COINS are pre-cached; adding an unknown coin turns hint on, removing it clears it.
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH,UNKNOWNCOIN');
    await expect(page.locator('#price-refresh-btn')).toHaveClass(/needs-refresh/);
    await page.locator('#price-coin-input').fill('ETH');
    await expect(page.locator('#price-refresh-btn')).not.toHaveClass(/needs-refresh/);
  });

  test('Refresh button has no needs-refresh when all textarea coins are already cached', async ({
    page,
  }) => {
    // MOCK_COINS pre-seeded in cache (ETH, BTC, SOL, XRP, BNB). Textarea limited to those.
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH,BTC,SOL');
    await expect(page.locator('#price-refresh-btn')).not.toHaveClass(/needs-refresh/);
  });

  test('Update text posts apply-price with a replacements array', async ({ page }) => {
    await setupPriceTabWithData(page);

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();

    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('apply-price');
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    expect(Array.isArray(replacements)).toBe(true);
    expect(replacements.length).toBeGreaterThan(0);
    for (const r of replacements) {
      expect(typeof r.nodeId).toBe('string');
      expect(typeof r.newText).toBe('string');
      expect(r.newText.length).toBeGreaterThan(0);
    }
  });

  test('prices-result with an error field shows a toast', async ({ page }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS);
    // Override the auto-response by posting an error result directly.
    await postSelectionContext(page, {
      type: 'prices-result',
      error: 'Rate limit reached',
      coins: {},
    });
    await expect(page.locator('#toast')).toContainText('Rate limit reached');
  });

  test('initial state before Scan shows "No frame or group selected" hint', async ({ page }) => {
    await openPriceTab(page);
    // priceCards is null — no scan has been triggered yet
    await expect(page.locator('#price-no-selection')).toContainText(
      'No frame or group selected in Figma.',
    );
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('scan result for empty frame (no variable layers) shows "No matching layer names"', async ({
    page,
  }) => {
    await openPriceTab(page);
    // Simulate Figma main thread: frame scanned but had no {crypto}/{price} layers
    await postSelectionContext(page, { type: 'price-layer-scan', cards: [] });
    await expect(page.locator('#price-no-selection')).toContainText(
      'No matching layer names found in selection.',
    );
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('unknown coin in textarea still fires apply-price with fallback dash for price', async ({
    page,
  }) => {
    await openPriceTab(page);
    // Override textarea to only contain a symbol not in MOCK_COINS
    await page.locator('#price-coin-input').fill('FAKECOIN');

    await postScanResult(page, MOCK_CARDS);
    // Mock responds with MOCK_COINS — FAKECOIN is absent, so cachedCoinData['FAKECOIN'] is undefined
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();

    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    expect(Array.isArray(replacements)).toBe(true);
    expect(replacements.length).toBeGreaterThan(0);

    // crypto role → the unknown symbol literal
    const cryptoReplacement = replacements.find((r) => r.nodeId === 'n1' || r.nodeId === 'n3');
    expect(cryptoReplacement?.newText).toBe('FAKECOIN');

    // price role → fallback '—' because no data for FAKECOIN
    const priceReplacement = replacements.find((r) => r.nodeId === 'n2' || r.nodeId === 'n4');
    expect(priceReplacement?.newText).toBe('—');
  });

  // ── Substring / embedded token tests ───────────────────────────────────────

  test('name prefix: layer named "A${price}" with real content "A$23.00" is treated as a full card', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'BCH Row',
        matches: [
          { nodeId: 'np1', layerName: 'BCH', currentText: 'BCH', role: 'crypto', isLiteral: true },
          { nodeId: 'np2', layerName: 'A${price}', currentText: 'A$23.00', role: 'price', namePrefix: 'A$' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });
    await expect(page.locator('#price-apply-btn')).toBeEnabled();
  });

  test('name prefix: apply produces "A$<price>" without doubling the dollar sign', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'BCH Row',
        matches: [
          { nodeId: 'np1', layerName: 'BCH', currentText: 'BCH', role: 'crypto', isLiteral: true },
          { nodeId: 'np2', layerName: 'A${price}', currentText: 'A$23.00', role: 'price', namePrefix: 'A$' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 'np2');
    expect(priceReplacement).toBeDefined();
    // Must start with "A$" (not "A$$")
    expect(priceReplacement!.newText).toMatch(/^A\$[^$]/);
    expect(priceReplacement!.newText).not.toContain('$$');
  });

  test('name prefix A${price}: with BTC / AUD literal, apply keeps single A$ + AUD amount (matches Figma bid style)', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'AUD Bid',
        matches: [
          {
            nodeId: 'apfx1',
            layerName: 'pair',
            currentText: 'BTC / AUD',
            role: 'crypto',
            isLiteral: true,
            quoteSymbol: 'BTC',
            vsCurrency: 'aud',
          },
          {
            nodeId: 'apfx2',
            layerName: 'A${price}',
            currentText: 'A$103,503',
            role: 'price',
            namePrefix: 'A$',
          },
        ],
      },
    ] as typeof MOCK_CARDS);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const priceReplacement = (msg!.replacements as Array<{ nodeId: string; newText: string }>).find(
      (r) => r.nodeId === 'apfx2',
    );
    expect(priceReplacement).toBeDefined();
    expect(priceReplacement!.newText).toMatch(/^A\$/);
    expect(priceReplacement!.newText).not.toMatch(/^A\$A\$/);
    expect(priceReplacement!.newText).toMatch(/118,?234/);
  });

  test('substring match: layer with "A${price}" content is treated as a full card', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'ETH Card',
        matches: [
          { nodeId: 's1', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
          { nodeId: 's2', layerName: 'price-label', currentText: 'A${price}', role: 'price', matchedVar: '{price}' },
        ],
      },
    ]);
    // Full card: has {crypto} + price layer → button must enable after prices load
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });
    await expect(page.locator('#price-apply-btn')).toBeEnabled();
  });

  test('substring match: apply replaces only the {price} token, preserving surrounding text', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'ETH Card',
        matches: [
          { nodeId: 's1', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
          { nodeId: 's2', layerName: 'price-label', currentText: 'A${price}', role: 'price', matchedVar: '{price}' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 's2');
    expect(priceReplacement).toBeDefined();
    // Must preserve the "A$" prefix and replace only the {price} token
    expect(priceReplacement!.newText).toMatch(/^A\$/);
    expect(priceReplacement!.newText).not.toContain('{price}');
  });

  // ── Partial-card skip tests ─────────────────────────────────────────────────

  test('partial card (price only, no {crypto}) is skipped — apply button stays disabled', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'Price Only Card',
        matches: [
          { nodeId: 'p1', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText('skipped');
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('partial card ({crypto} only, no price layers) is skipped — apply button stays disabled', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'Crypto Only Card',
        matches: [
          { nodeId: 'q1', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText('skipped');
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  // ── Re-apply: layer name as stable anchor ──────────────────────────────────

  test('re-apply: name={price} content=$2,279.40 — detected via name, number gets overwritten', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'r2', layerName: '{crypto}', currentText: '{crypto}', role: 'crypto' },
          { nodeId: 'r1', layerName: '{price}', currentText: '$999.99', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 'r1');
    expect(priceReplacement).toBeDefined();
    // Content was already a number — name match must have detected it, new price written
    expect(priceReplacement!.newText).not.toBe('$999.99');
    expect(priceReplacement!.newText.length).toBeGreaterThan(0);
  });

  test('re-apply: name={volume} content=$33.92B — does not duplicate B suffix', async ({ page }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'vol1', layerName: 'BTC', currentText: 'BTC', role: 'crypto', isLiteral: true },
          { nodeId: 'vol2', layerName: '{volume}', currentText: '$33.92B', role: 'volume' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    const replacements = await clickApplyPriceAndCapture(page);
    const volumeReplacement = replacements.find((r) => r.nodeId === 'vol2');
    expect(volumeReplacement).toBeDefined();
    assertNoAccumulatedLargeSuffix(volumeReplacement!.newText);
  });

  test('re-apply twice: volume with corrupted BB suffix self-heals to single B', async ({ page }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'vol3', layerName: 'BTC', currentText: 'BTC', role: 'crypto', isLiteral: true },
          { nodeId: 'vol4', layerName: '{volume}', currentText: '$33.92BB', role: 'volume' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    const replacements = await clickApplyPriceAndCapture(page);
    const volumeReplacement = replacements.find((r) => r.nodeId === 'vol4');
    expect(volumeReplacement).toBeDefined();
    assertNoAccumulatedLargeSuffix(volumeReplacement!.newText);
  });

  test('regression: volume/mcap suffix does not accumulate over repeated scan → apply cycles', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');

    type ScanMatch = (typeof MOCK_CARDS)[number]['matches'][number];
    const cryptoMatch: ScanMatch = {
      nodeId: 'volr-c',
      layerName: 'BTC',
      currentText: 'BTC',
      role: 'crypto',
      isLiteral: true,
    };

    let volumeText = '{volume}';
    let mcapText = '{mcap}';

    for (let cycle = 0; cycle < 3; cycle++) {
      await postScanResult(page, [
        {
          cardName: 'Row',
          matches: [
            cryptoMatch,
            { nodeId: 'volr-v', layerName: '{volume}', currentText: volumeText, role: 'volume' },
            { nodeId: 'volr-m', layerName: '{mcap}', currentText: mcapText, role: 'mcap' },
          ],
        },
      ]);
      await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

      const replacements = await clickApplyPriceAndCapture(page);
      const vol = replacements.find((r) => r.nodeId === 'volr-v');
      const mcap = replacements.find((r) => r.nodeId === 'volr-m');
      expect(vol, `cycle ${cycle + 1} volume`).toBeDefined();
      expect(mcap, `cycle ${cycle + 1} mcap`).toBeDefined();

      assertNoAccumulatedLargeSuffix(vol!.newText);
      assertNoAccumulatedLargeSuffix(mcap!.newText);

      volumeText = vol!.newText;
      mcapText = mcap!.newText;
    }

    expect(trailingLargeSuffixLength(volumeText)).toBe(1);
    expect(trailingLargeSuffixLength(mcapText)).toBe(1);
  });

  // ── Both name and content contain the token ─────────────────────────────────

  test('both-token: name=A${price} content=A${price} — matchedVar (chars) wins, apply → A$<price> no double $', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 't2', layerName: 'ticker', currentText: 'ETH', role: 'crypto', isLiteral: true },
          { nodeId: 't1', layerName: 'A${price}', currentText: 'A${price}', role: 'price', matchedVar: '{price}' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 't1');
    expect(priceReplacement).toBeDefined();
    expect(priceReplacement!.newText).toMatch(/^A\$[^$]/);
    expect(priceReplacement!.newText).not.toContain('{price}');
    expect(priceReplacement!.newText).not.toContain('$$');
  });

  // ── Generic name, already-replaced content (2nd apply simulation) ───────────

  test('second-apply: generic name content=$2,279.40 — not detected, button stays disabled', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'g1', layerName: 'price-display', currentText: '$2,279.40', role: 'price' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText('skipped');
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('second-apply: generic name content=A$2,279.40 — not detected, button stays disabled', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'g2', layerName: 'price-display', currentText: 'A$2,279.40', role: 'price' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText('skipped');
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  // ── Edge case: name={crypto} but content=ETH ────────────────────────────────

  test('edge-case: name={crypto} content=ETH — literal ticker is preserved and only price layers update', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'ec1', layerName: '{crypto}', currentText: 'ETH', role: 'crypto' },
          { nodeId: 'ec2', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    // Literal ticker text under {crypto} should be preserved.
    const cryptoReplacement = replacements.find((r) => r.nodeId === 'ec1');
    expect(cryptoReplacement).toBeUndefined();
    // Price layer should still be updated.
    expect(replacements.find((r) => r.nodeId === 'ec2')).toBeDefined();
  });

  // ── Card boundary: single row frame whose children are individual text nodes ──
  // Before the fix, scanPriceLayers split the Row's direct text children into
  // separate partial cards. After the fix the whole row is one full card.
  // These tests assert the UI behaviour once code.ts produces the correct card.

  test('card boundary fix: row with isLiteral BNB + namePrefix A{price} produces one full card', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'BNB Row',
        matches: [
          { nodeId: 'cb1', layerName: 'BNB', currentText: 'BNB', role: 'crypto', isLiteral: true },
          { nodeId: 'cb2', layerName: 'A{price}', currentText: 'A$0.44', role: 'price', namePrefix: 'A' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });
    await expect(page.locator('#price-apply-btn')).toBeEnabled();
  });

  test('card boundary fix: apply on BNB row produces A$<bnbPrice> (no double $)', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BNB');
    await postScanResult(page, [
      {
        cardName: 'BNB Row',
        matches: [
          { nodeId: 'cb1', layerName: 'BNB', currentText: 'BNB', role: 'crypto', isLiteral: true },
          { nodeId: 'cb2', layerName: 'A{price}', currentText: 'A$0.44', role: 'price', namePrefix: 'A' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () => (window as unknown as { __applyPriceCapture: Record<string, unknown> | null }).__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    // cb1 is isLiteral — must NOT appear in replacements
    expect(replacements.find((r) => r.nodeId === 'cb1')).toBeUndefined();
    // cb2 gets A + BNB price ($622.29) → "A$622.29"; prefix 'A' + raw '$622.29' = 'A$622.29'
    const priceReplacement = replacements.find((r) => r.nodeId === 'cb2');
    expect(priceReplacement).toBeDefined();
    expect(priceReplacement!.newText).toMatch(/^A\$[^$]/);
    expect(priceReplacement!.newText).not.toContain('$$');
    expect(priceReplacement!.newText).toContain('622');
  });

  test('card boundary regression: two partial children (old split behavior) are both skipped', async ({
    page,
  }) => {
    // Simulates what the OLD scanPriceLayers would have sent when a Row frame
    // was selected: one card per direct child text node, each partial.
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'BNB',
        matches: [
          { nodeId: 'reg1', layerName: 'BNB', currentText: 'BNB', role: 'crypto', isLiteral: true },
        ],
      },
      {
        cardName: 'A{price}',
        matches: [
          { nodeId: 'reg2', layerName: 'A{price}', currentText: 'A$0.44', role: 'price', namePrefix: 'A' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText('skipped');
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  // ── Auto-detect ticker tests ────────────────────────────────────────────────

  test('auto-detect: summary names the detected tickers when isLiteral cards found', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS_AUTO_DETECT);
    await expect(page.locator('#price-scan-summary')).toContainText('detected');
  });

  test('auto-detect: literal ticker node is NOT in apply-price replacements', async ({ page }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS_AUTO_DETECT);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;

    // Ticker nodes (a1 = BTC, b1 = ETH) must NOT appear — they are preserved as-is
    expect(replacements.find((r) => r.nodeId === 'a1')).toBeUndefined();
    expect(replacements.find((r) => r.nodeId === 'b1')).toBeUndefined();

    // Data layers must appear
    expect(replacements.find((r) => r.nodeId === 'a2')).toBeDefined(); // BTC price
    expect(replacements.find((r) => r.nodeId === 'b2')).toBeDefined(); // ETH price
  });

  test('auto-detect: each card uses its own detected ticker for the price fetch', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS_AUTO_DETECT);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;

    // BTC card price (a2) should use BTC data from MOCK_COINS ($76,511)
    const btcPrice = replacements.find((r) => r.nodeId === 'a2');
    expect(btcPrice?.newText).toContain('76'); // BTC is ~$76k

    // ETH card price (b2) should use ETH data ($2,279)
    const ethPrice = replacements.find((r) => r.nodeId === 'b2');
    expect(ethPrice?.newText).toContain('2'); // ETH is ~$2k range
  });

  test('fiat pairs: BTC/AUD, BTC / AUD, and BTCAUD use AUD quote; plain BTC uses USD', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS_FIAT_PAIR_VARIANTS as typeof MOCK_CARDS);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;

    for (const id of ['fp1p', 'fp2p', 'fp3p']) {
      const r = replacements.find((x) => x.nodeId === id);
      expect(r, id).toBeDefined();
      expect(r!.newText).toMatch(/A\$/);
      expect(r!.newText).toContain('118');
    }
    const usdP = replacements.find((r) => r.nodeId === 'fp4p');
    expect(usdP?.newText).toMatch(/^\$/);
    expect(usdP?.newText).toContain('76');
    expect(usdP?.newText).not.toContain('118');
  });

  test('fiat pair: missing AUD slice in cache falls back to USD price formatting', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.evaluate(() => {
      window.postMessage(
        {
          pluginMessage: {
            type: 'prices-result',
            source: 'coingecko',
            coins: {
              BTC: { price: 99123.45, change: -1.1, volume: 3.3e10, mcap: 1.5e12 },
            },
          },
        },
        '*',
      );
    });

    await postScanResult(page, [
      {
        cardName: 'AudMissing',
        matches: [
          {
            nodeId: 'fm1',
            layerName: 'pair',
            currentText: 'BTC/AUD',
            role: 'crypto',
            isLiteral: true,
            quoteSymbol: 'BTC',
            vsCurrency: 'aud',
          },
          { nodeId: 'fm1p', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ] as typeof MOCK_CARDS);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );
    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const r = replacements.find((x) => x.nodeId === 'fm1p');
    expect(r?.newText).toMatch(/^\$/);
    expect(r?.newText).toMatch(/99,123/);
    expect(r?.newText).not.toMatch(/A\$/);
  });

  test('Figma grid table: two placeholder rows scan as separate cards and get distinct pool coins', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH,BTC,SOL');
    await postScanResult(page, MOCK_CARDS_FIGMA_GRID_TABLE as typeof MOCK_CARDS);
    await expect(page.locator('#price-scan-summary')).toContainText('2 cards');
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const row1Crypto = replacements.find((r) => r.nodeId === 'grid-r1-c');
    const row2Crypto = replacements.find((r) => r.nodeId === 'grid-r2-c');
    const row1Price = replacements.find((r) => r.nodeId === 'grid-r1-p');
    const row2Price = replacements.find((r) => r.nodeId === 'grid-r2-p');

    expect(row1Crypto).toBeDefined();
    expect(row2Crypto).toBeDefined();
    expect(row1Crypto!.newText).not.toBe(row2Crypto!.newText);
    expect(row1Price!.newText).not.toBe(row2Price!.newText);
    expect(row1Price!.newText).not.toBe('—');
    expect(row2Price!.newText).not.toBe('—');
  });

  test('Figma landing table: AUD pair rows with {price} layer (all slash spacing styles)', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC,ETH,USDT,USDC,SOL,XRP');
    await postScanResult(page, MOCK_CARDS_FIGMA_LANDING_PAIR_ROWS as typeof MOCK_CARDS);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;

    const cases: Array<{ nodeId: string; audPattern: RegExp }> = [
      { nodeId: 'fl-btc-p', audPattern: /118,?234/ },
      { nodeId: 'fl-eth-p', audPattern: /4,?730/ },
      { nodeId: 'fl-usdt-p', audPattern: /1\.51/ },
      { nodeId: 'fl-usdc-p', audPattern: /1\.40/ },
      { nodeId: 'fl-sol-p', audPattern: /116\.25/ },
      { nodeId: 'fl-xrp-p', audPattern: /1\.43/ },
    ];

    for (const { nodeId, audPattern } of cases) {
      const r = replacements.find((x) => x.nodeId === nodeId);
      expect(r, nodeId).toBeDefined();
      expect(r!.newText, nodeId).toMatch(/A\$/);
      expect(r!.newText, nodeId).toMatch(audPattern);
    }

    for (const id of [
      'fl-btc-c',
      'fl-eth-c',
      'fl-usdt-c',
      'fl-usdc-c',
      'fl-sol-c',
      'fl-xrp-c',
    ]) {
      expect(replacements.find((x) => x.nodeId === id), id).toBeUndefined();
    }
  });

  test('Figma-style row: layer named {price} with static A$ bid text replaces numeric token with AUD quote', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'BidRenamed',
        matches: [
          {
            nodeId: 'fl2-btc-c',
            layerName: 'pair',
            currentText: 'BTC / AUD',
            role: 'crypto',
            isLiteral: true,
            quoteSymbol: 'BTC',
            vsCurrency: 'aud',
          },
          {
            nodeId: 'fl2-btc-p',
            layerName: '{price}',
            currentText: 'A$103,503',
            role: 'price',
          },
        ],
      },
    ] as typeof MOCK_CARDS);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );
    expect(msg).not.toBeNull();
    const r = (msg!.replacements as Array<{ nodeId: string; newText: string }>).find(
      (x) => x.nodeId === 'fl2-btc-p',
    );
    expect(r?.newText).toMatch(/^A\$/);
    expect(r?.newText).toMatch(/118,?234/);
  });

  test('bug repro: name={crypto} with literal BTC content should preserve ticker and only update price', async ({
    page,
  }) => {
    await openPriceTab(page);
    // Force a pool coin different from the literal ticker so overwrite is obvious.
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'br1', layerName: '{crypto}', currentText: 'BTC', role: 'crypto' },
          { nodeId: 'br2', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    // Desired behavior: literal BTC should be preserved, so crypto layer should not be replaced.
    expect(replacements.find((r) => r.nodeId === 'br1')).toBeUndefined();
    expect(replacements.find((r) => r.nodeId === 'br2')).toBeDefined();
  });

  test('summary uses detected ticker wording when {crypto} content is literal text', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'sum1', layerName: '{crypto}', currentText: 'test', role: 'crypto' },
          { nodeId: 'sum2', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText('test detected');
    await expect(page.locator('#price-scan-summary')).not.toContainText('coin from pool');
  });

  test('summary warns when detected literal ticker is not in coin list', async ({ page }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'sum3', layerName: '{crypto}', currentText: 'test', role: 'crypto' },
          { nodeId: 'sum4', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await expect(page.locator('#price-scan-summary')).toContainText(
      'test not in the coin list — price will not be inserted.',
    );
  });

  test('bug repro: content A$132.22 should keep A$ prefix and only update numeric part', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'br3', layerName: 'ticker', currentText: 'BTC', role: 'crypto', isLiteral: true },
          { nodeId: 'br4', layerName: '{price}', currentText: 'A$132.22', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 'br4');
    expect(priceReplacement).toBeDefined();
    // Desired behavior: keep "A$" wrapper and update only the numeric value.
    expect(priceReplacement!.newText).toMatch(/^A\$/);
  });

  test('bug related: name={crypto} with BTC content should use BTC price (not pool coin)', async ({
    page,
  }) => {
    await openPriceTab(page);
    // Make pool start with ETH so any BTC result proves literal content took precedence.
    await page.locator('#price-coin-input').fill('ETH,BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'br5', layerName: '{crypto}', currentText: 'BTC', role: 'crypto' },
          { nodeId: 'br6', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    // Desired behavior: literal BTC should be preserved.
    expect(replacements.find((r) => r.nodeId === 'br5')).toBeUndefined();
    // Desired behavior: BTC price should be used (~$76k in MOCK_COINS), not ETH (~$2k).
    const priceReplacement = replacements.find((r) => r.nodeId === 'br6');
    expect(priceReplacement).toBeDefined();
    expect(priceReplacement!.newText).toContain('76');
  });

  test('bug related: name={crypto} with lowercase btc content should still be preserved and treated as literal', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH, BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'br7', layerName: '{crypto}', currentText: 'btc', role: 'crypto' },
          { nodeId: 'br8', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    // Desired behavior: crypto text "btc" should be treated as literal ticker and left untouched.
    expect(replacements.find((r) => r.nodeId === 'br7')).toBeUndefined();
    expect(replacements.find((r) => r.nodeId === 'br8')).toBeDefined();
  });

  test('bug related: A$1,234.56 should keep A$ prefix and update only numeric fragment', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'br9', layerName: 'ticker', currentText: 'BTC', role: 'crypto', isLiteral: true },
          { nodeId: 'br10', layerName: '{price}', currentText: 'A$1,234.56', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 'br10');
    expect(priceReplacement).toBeDefined();
    // Desired behavior: preserve wrapper prefix, only number should change.
    expect(priceReplacement!.newText).toMatch(/^A\$/);
  });

  test('bug related: text "A$132.22 USD" should keep surrounding text and only replace number', async ({
    page,
  }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('BTC');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'br11', layerName: 'ticker', currentText: 'BTC', role: 'crypto', isLiteral: true },
          { nodeId: 'br12', layerName: '{price}', currentText: 'A$132.22 USD', role: 'price' },
        ],
      },
    ]);
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 'br12');
    expect(priceReplacement).toBeDefined();
    // Desired behavior: keep prefix/suffix labels; only numeric section should change.
    expect(priceReplacement!.newText).toMatch(/^A\$/);
    expect(priceReplacement!.newText).toMatch(/ USD$/);
  });
});

// ─── Settings — Price API Keys + Price formatting ─────────────────────────────

test.describe('Settings — Price API Keys and Price formatting', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page, MOCK_COINS);
    await page.goto('/ui.html');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.removeItem('web3dpal_api_keys');
    }, STORAGE_KEY);
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
  });

  test('Price API Keys section is visible with CoinGecko key input', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Price API Keys' })).toBeVisible();
    await expect(page.locator('#settings-cg-key')).toBeVisible();
    // CMC field is hidden
    await expect(page.locator('#settings-cmc-key')).toBeHidden();
  });

  test('Price formatting section has Decimal places field and format checkboxes', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'Price formatting' })).toBeVisible();
    // Decimal places uses the same settings-field style as "Characters at start"
    await expect(page.getByLabel('Decimal places')).toBeVisible();
    await expect(page.getByLabel('Decimal places')).toHaveValue('2');
    await expect(page.locator('#price-show-symbol')).toBeChecked();
    await expect(page.locator('#price-show-commas')).toBeChecked();
  });

  test('Save API Key with valid CG- key posts save-api-keys', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __apiKeyCapture: Record<string, unknown> | null };
      w.__apiKeyCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'save-api-keys') {
          w.__apiKeyCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#settings-cg-key').fill('CG-validkey123');
    await page.getByRole('button', { name: 'Save API Key' }).click();

    const msg = await page.evaluate(
      () =>
        (window as unknown as { __apiKeyCapture: Record<string, unknown> | null }).__apiKeyCapture,
    );

    expect(msg).not.toBeNull();
    expect(msg!.type).toBe('save-api-keys');
    expect(msg!.coingeckoKey).toBe('CG-validkey123');
  });

  test('API key input is pre-filled when key is stored', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'web3dpal_api_keys',
        JSON.stringify({ cgKey: 'CG-stored123', cmcKey: '' }),
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.locator('#settings-cg-key')).toHaveValue('CG-stored123');
  });

  test('invalid key format shows inline error and does not post save-api-keys', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __apiKeyCapture: Record<string, unknown> | null };
      w.__apiKeyCapture = null;
      window.addEventListener('message', (e: Event) => {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'save-api-keys') w.__apiKeyCapture = pm;
      });
    });

    await page.locator('#settings-cg-key').fill('not-a-valid-key');
    await page.getByRole('button', { name: 'Save API Key' }).click();

    await expect(page.locator('#settings-cg-key-error')).toBeVisible();
    const captured = await page.evaluate(
      () =>
        (window as unknown as { __apiKeyCapture: Record<string, unknown> | null }).__apiKeyCapture,
    );
    expect(captured).toBeNull();
  });

  test('typing in the CG key field clears the inline error', async ({ page }) => {
    // Trigger error first
    await page.locator('#settings-cg-key').fill('bad');
    await page.getByRole('button', { name: 'Save API Key' }).click();
    await expect(page.locator('#settings-cg-key-error')).toBeVisible();

    // Typing should clear it immediately
    await page.locator('#settings-cg-key').fill('CG-abc');
    await expect(page.locator('#settings-cg-key-error')).toBeHidden();
  });

  test('empty key is allowed and posts save-api-keys with empty string', async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { __apiKeyCapture: Record<string, unknown> | null };
      w.__apiKeyCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'save-api-keys') {
          w.__apiKeyCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    // Leave the CG key empty and click save
    await page.getByRole('button', { name: 'Save API Key' }).click();

    const msg = await page.evaluate(
      () =>
        (window as unknown as { __apiKeyCapture: Record<string, unknown> | null }).__apiKeyCapture,
    );
    expect(msg).not.toBeNull();
    expect(msg!.coingeckoKey).toBe('');
  });
});

// ─── Price tab — no cached prices (Refresh not yet clicked) ──────────────────
// Uses installFigmaStorageMock with empty coins so localStorage is NOT pre-seeded.
// fetch-prices will respond with {} (empty), simulating a first run with no cached data.

test.describe('Price tab — no cached prices', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page, {});
    await page.goto('/ui.html');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
      localStorage.setItem('web3dpal_api_keys', JSON.stringify({ cgKey: 'CG-testkey', cmcKey: '' }));
    }, STORAGE_KEY);
    await page.reload();
  });

  test('scan finds full card but no prices cached → button disabled, "Click Refresh" shown', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS);
    await expect(page.locator('#price-scan-summary')).toContainText('Click Refresh to load prices.');
    await expect(page.locator('#price-apply-btn')).toBeDisabled();
  });

  test('Refresh button shows needs-refresh when prices are missing', async ({ page }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS);
    await expect(page.locator('#price-refresh-btn')).toHaveClass(/needs-refresh/);
  });

  test('Refresh stays highlighted after fetch when response has no coin data', async ({ page }) => {
    // Mock returns {} (empty), so cachedCoinData stays empty — hint remains
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS);
    await expect(page.locator('#price-refresh-btn')).toHaveClass(/needs-refresh/);
    await page.locator('#price-refresh-btn').click();
    await page.locator('#price-refresh-btn:not([disabled])').waitFor({ timeout: 5000 });
    // All textarea coins still missing → hint stays on
    await expect(page.locator('#price-refresh-btn')).toHaveClass(/needs-refresh/);
  });

  test('unknown token in textarea: no cache → Refresh button highlighted', async ({ page }) => {
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('UNKNOWNCOIN');
    // Even without a scan, updating textarea triggers the hint
    await expect(page.locator('#price-refresh-btn')).toHaveClass(/needs-refresh/);
  });

  test('unknown literal ticker detected in scan → Refresh button highlighted', async ({ page }) => {
    await openPriceTab(page);
    await postScanResult(page, [
      {
        cardName: 'Mystery Row',
        matches: [
          { nodeId: 'unk1', layerName: 'ZZZ', currentText: 'ZZZ', role: 'crypto', isLiteral: true },
          { nodeId: 'unk2', layerName: '{price}', currentText: '{price}', role: 'price' },
        ],
      },
    ]);
    await expect(page.locator('#price-refresh-btn')).toHaveClass(/needs-refresh/);
  });

  test('custom ticker (DAI) added to textarea: scan sends it in knownTickers so it can be auto-detected', async ({
    page,
  }) => {
    // The fix: knownTickers is sourced from the textarea, not a hardcoded list.
    // Adding DAI to the textarea means a Figma layer with "DAI" text is now detected
    // as isLiteral on the next scan — no code change needed for new tokens.
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('ETH, DAI');

    await page.evaluate(() => {
      const w = window as unknown as { __scanCapture: Record<string, unknown> | null };
      w.__scanCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'scan-price-layers') {
          w.__scanCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });
    await page.getByRole('button', { name: 'Scan' }).click();

    const msg = await page.evaluate(
      () => (window as unknown as { __scanCapture: Record<string, unknown> | null }).__scanCapture,
    );
    expect(msg).not.toBeNull();
    expect((msg!.knownTickers as string[])).toContain('DAI');
    expect((msg!.knownTickers as string[])).toContain('ETH');
  });

  test('unknown token: after Refresh with no data for it, apply gives — for price', async ({
    page,
  }) => {
    // Mock responds with empty coins (cfg.coins = {}), so UNKNOWNCOIN has no data.
    // priceLoaded becomes true but cachedCoinData['UNKNOWNCOIN'] is undefined.
    await openPriceTab(page);
    await page.locator('#price-coin-input').fill('UNKNOWNCOIN');
    await postScanResult(page, MOCK_CARDS);
    // Click Refresh — mock responds with {} (no data for UNKNOWNCOIN)
    await page.locator('#price-refresh-btn').click();
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    const priceReplacement = replacements.find((r) => r.nodeId === 'n2' || r.nodeId === 'n4');
    expect(priceReplacement?.newText).toBe('—');
  });

  test('layer names {crypto}/{price}/{change} with content test/--/--: Refresh + Scan + Update keeps ticker and writes fallbacks', async ({
    page,
  }) => {
    await openPriceTab(page);
    // Ensure "test" is treated as a known literal ticker during scan.
    await page.locator('#price-coin-input').fill('TEST');
    await postScanResult(page, [
      {
        cardName: 'Row',
        matches: [
          { nodeId: 'x1', layerName: '{crypto}', currentText: 'test', role: 'crypto' },
          { nodeId: 'x2', layerName: '{price}', currentText: '--', role: 'price' },
          { nodeId: 'x3', layerName: '{change}', currentText: '--', role: 'change' },
        ],
      },
    ]);

    // In this suite, Refresh returns empty prices (installFigmaStorageMock(..., {})).
    await page.locator('#price-refresh-btn').click();
    await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });

    await page.evaluate(() => {
      const w = window as unknown as { __applyPriceCapture: Record<string, unknown> | null };
      w.__applyPriceCapture = null;
      window.addEventListener('message', function handler(e: Event) {
        const pm = (e as MessageEvent).data?.pluginMessage as Record<string, unknown> | undefined;
        if (pm?.type === 'apply-price') {
          w.__applyPriceCapture = pm;
          window.removeEventListener('message', handler);
        }
      });
    });

    await page.locator('#price-apply-btn').click();
    const msg = await page.evaluate(
      () =>
        (window as unknown as { __applyPriceCapture: Record<string, unknown> | null })
          .__applyPriceCapture,
    );

    expect(msg).not.toBeNull();
    const replacements = msg!.replacements as Array<{ nodeId: string; newText: string }>;
    // Literal ticker under {crypto} should be preserved.
    expect(replacements.find((r) => r.nodeId === 'x1')).toBeUndefined();
    // Missing coin data -> fallback em dash for both price and change.
    expect(replacements.find((r) => r.nodeId === 'x2')?.newText).toBe('—');
    expect(replacements.find((r) => r.nodeId === 'x3')?.newText).toBe('—');
  });
});
