import { chromium, expect } from '@playwright/test';
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported import fixture, not natural progression. Standard qa.mjs retains WebGL.
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const activate = (locator) => (mobile ? locator.tap() : locator.click());
    const ready = () =>
      page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    // Install before boot so every game timer is controlled, then allow startup.
    await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-19T12:00:00Z'));
    await page.goto(`${base}/?qa=1`);
    await page.clock.runFor(1000);
    await ready();
    const snapshot = async () => {
      await activate(button('Settings'));
      await activate(button('Copy / download save'));
      const { version, savedAt, pendingOffline, ...data } = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      expect(version).toBe(4);
      expect(pendingOffline).toBe(0);
      await activate(button('Back to the neighborhood'));
      return data;
    };
    const original = await snapshot();
    await activate(button('Kitchen'));
    const help = page.getByRole('region', {
      name: 'Plan your progress',
      exact: true,
    });
    await expect(help).toBeVisible();
    for (const text of [
      '60 seconds',
      '50%',
      '8 hours',
      'both streets',
      '10 minutes',
      '10 gems',
    ])
      await expect(help).toContainText(text);
    const link = help.getByRole('button', {
      name: 'Open upgrades and boosts',
      exact: true,
    });
    if (mobile) {
      const bounds = await link.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await link.tap();
    } else {
      await link.focus();
      await page.keyboard.press('Enter');
    }
    await expect(
      page.getByRole('heading', { name: 'A little extra magic', exact: true }),
    ).toBeVisible();
    await expect(button('Upgrades')).toHaveAttribute('aria-current', 'page');
    await expect(button('Start rush hour · 💎 10')).toBeDisabled();
    expect(await snapshot()).toEqual(original);

    // Supported fixture supplies exactly enough for one existing global and boost.
    const fixture = {
      ...original,
      coins: 2500,
      gems: 10,
      version: 4,
      savedAt: Date.parse('2026-10-19T12:00:01Z'),
      pendingOffline: 0,
    };
    await activate(button('Settings'));
    await page
      .getByLabel('Import a saved street')
      .fill(JSON.stringify(fixture));
    await activate(button('Restore save'));
    await expect(
      page.getByText('Street restored.', { exact: true }),
    ).toBeVisible();
    await activate(button('Back to the neighborhood'));
    await activate(button('Kitchen'));
    await activate(link);
    await activate(button('Buy upgrade · 🪙 2.5K'));
    await activate(button('Start rush hour · 💎 10'));
    const purchased = await snapshot();
    expect(purchased.coins).toBe(0);
    expect(purchased.gems).toBe(0);
    expect(purchased.upgrades).toEqual(['ingredients']);
    expect(purchased.boostUntil).toBe(fixture.savedAt + 600000);
    expect(purchased.restaurants).toEqual(original.restaurants);
    expect(purchased.neighborhood).toEqual(original.neighborhood);
    await activate(button('Settings'));
    await activate(button('Copy / download save'));
    const exported = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    expect(Object.keys(exported).sort()).toEqual(Object.keys(fixture).sort());
    expect(exported.version).toBe(4);
    await activate(button('Back to the neighborhood'));
    await page.reload();
    await expect(button('Kitchen')).toBeVisible();
    expect(await snapshot()).toEqual(purchased);
    await activate(button('Kitchen'));
    await expect(help).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await activate(link);
    await expect(button('✓ Purchased')).toBeDisabled();
    await expect(button('⚡ Boost active')).toBeDisabled();
    expect(errors).toEqual([]);
    console.log(
      `PASS progression ${mobile ? 'mobile taps' : 'desktop keyboard'}: guidance, navigation, unchanged data/schema, supported fixture purchases/reload, overflow, zero page errors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
