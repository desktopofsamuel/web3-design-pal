import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'web3dpal_truncate_rules';
const BUY_ME_COFFEE_URL = 'https://example.com/buy-me-coffee';
const PROFILE_URL = 'https://desktopofsamuel.com';
const ethLine = /^0x[a-f0-9]{40}$/;
/** Base58 alphabet (no 0 O I l) */
const solPattern = /^[1-9A-HJ-NP-Za-km-z]{44}$/;

// ─── Price tab mock data (real CoinGecko response, 2024-04) ──────────────────
const MOCK_COINS: Record<string, { price: number; change: number; volume: number; mcap: number }> =
  {
    ETH: {
      price: 2279.4,
      change: -1.7090294198921991,
      volume: 13619093866.416811,
      mcap: 275124785372.0594,
    },
    BTC: {
      price: 76511,
      change: -1.6369118028497176,
      volume: 33915634645.395718,
      mcap: 1532118888510.001,
    },
    SOL: {
      price: 83.71,
      change: -1.6606195765535383,
      volume: 2891995107.941362,
      mcap: 48236128508.15029,
    },
    XRP: {
      price: 1.39,
      change: -1.9317122850842732,
      volume: 1849986074.768185,
      mcap: 85569581780.77618,
    },
    BNB: {
      price: 622.29,
      change: -0.759411015015047,
      volume: 846504885.6417747,
      mcap: 83868252775.19609,
    },
  };

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
  coins: Record<string, { price: number; change: number; volume: number; mcap: number }> = {},
): Promise<void> {
  await page.addInitScript(
    (cfg: {
      key: string;
      buy: string;
      profile: string;
      coins: Record<string, { price: number; change: number; volume: number; mcap: number }>;
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
    },
    { key: STORAGE_KEY, buy: BUY_ME_COFFEE_URL, profile: PROFILE_URL, coins },
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

  test('opens with heading, copy, Save/Back, and default start 6 / end 4', async ({ page }) => {
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
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
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

  test('Back after editing shows unsaved toast and returns to wallet', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Characters at start').fill('9');
    await page.getByRole('button', { name: 'Back' }).click();

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

/**
 * Full happy-path setup: navigate to Price tab, post a scan result, wait for
 * fetch-prices to be answered by the mock (which immediately returns MOCK_COINS),
 * and wait for the apply button to become enabled.
 */
async function setupPriceTabWithData(
  page: import('@playwright/test').Page,
  cards: typeof MOCK_CARDS = MOCK_CARDS,
): Promise<void> {
  await openPriceTab(page);
  await postScanResult(page, cards);
  // The mock auto-responds to fetch-prices; wait for apply button to enable.
  await page.locator('#price-apply-btn:not([disabled])').waitFor({ timeout: 5000 });
}

// ─── Price tab tests ──────────────────────────────────────────────────────────

test.describe('Price tab', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page, MOCK_COINS);
    await page.goto('/ui.html');
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
    await page.reload();
  });

  test('Price tab is shown and Wallet tab is hidden when Price tab is clicked', async ({
    page,
  }) => {
    await openPriceTab(page);
    await expect(page.locator('#view-price')).toBeVisible();
    await expect(page.locator('#view-wallet')).toHaveClass(/view-hidden/);
  });

  test('default coin textarea contains expected coins', async ({ page }) => {
    await openPriceTab(page);
    const value = await page.locator('#price-coin-input').inputValue();
    const coins = value.split(',').map((s) => s.trim());
    expect(coins).toContain('ETH');
    expect(coins).toContain('BTC');
    expect(coins).toContain('SOL');
    expect(coins.length).toBeGreaterThanOrEqual(30);
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
  });

  test('price-layer-scan with 2 cards shows pair count in summary', async ({ page }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS);
    await expect(page.locator('#price-scan-summary')).toContainText('2 pairs');
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

  test('after prices load, summary says Ready to apply and Update text is enabled', async ({
    page,
  }) => {
    await setupPriceTabWithData(page);
    await expect(page.locator('#price-scan-summary')).toContainText('Ready to apply');
    await expect(page.locator('#price-apply-btn')).toBeEnabled();
  });

  test('source banner appears and names CoinGecko after prices load', async ({ page }) => {
    await setupPriceTabWithData(page);
    await expect(page.locator('#price-source-banner')).toBeVisible();
    await expect(page.locator('#price-source-banner')).toContainText('CoinGecko');
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

  // ── Auto-detect ticker tests ────────────────────────────────────────────────

  test('auto-detect: summary says "cards with detected ticker" when isLiteral cards found', async ({
    page,
  }) => {
    await openPriceTab(page);
    await postScanResult(page, MOCK_CARDS_AUTO_DETECT);
    await expect(page.locator('#price-scan-summary')).toContainText('detected ticker');
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

  test('Save API Keys with valid CG- key posts save-api-keys', async ({ page }) => {
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
    await page.getByRole('button', { name: 'Save API Keys' }).click();

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
    await page.getByRole('button', { name: 'Save API Keys' }).click();

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
    await page.getByRole('button', { name: 'Save API Keys' }).click();
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
    await page.getByRole('button', { name: 'Save API Keys' }).click();

    const msg = await page.evaluate(
      () =>
        (window as unknown as { __apiKeyCapture: Record<string, unknown> | null }).__apiKeyCapture,
    );
    expect(msg).not.toBeNull();
    expect(msg!.coingeckoKey).toBe('');
  });
});
