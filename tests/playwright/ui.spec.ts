import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'web3dpal_truncate_rules';
const BUY_ME_COFFEE_URL = 'https://example.com/buy-me-coffee';
const PROFILE_URL = 'https://desktopofsamuel.com';
const ethLine = /^0x[a-f0-9]{40}$/;
/** Base58 alphabet (no 0 O I l) */
const solPattern = /^[1-9A-HJ-NP-Za-km-z]{44}$/;

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
async function installFigmaStorageMock(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((cfg: { key: string; buy: string; profile: string }) => {
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
    });
  }, { key: STORAGE_KEY, buy: BUY_ME_COFFEE_URL, profile: PROFILE_URL });
}

test.describe('Web3 Design Pal UI', () => {
  test.beforeEach(async ({ page }) => {
    await installFigmaStorageMock(page);
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
    await page.getByRole('button', { name: 'Save' }).click();
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
    await installFigmaStorageMock(page);
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

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
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
    await page.getByRole('button', { name: 'Save' }).click();

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
    await page.getByRole('button', { name: 'Save' }).click();

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
