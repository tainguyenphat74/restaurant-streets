import { chromium, expect } from '@playwright/test';
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported imports are fixtures, never claimed as natural progression. Canvas
// matches existing fixture QA; standard gameplay QA separately covers WebGL.
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
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const tap = async (locator) => (mobile ? locator.tap() : locator.click());
    const ready = () =>
      page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    const kitchen = () => button('Kitchen').click();
    const card = (name) =>
      page.getByRole('region', { name: `${name} honors`, exact: true });
    const maple = card('Maple Street'),
      river = card('Riverside Market');
    await page.goto(`${base}/?qa=1`);
    await ready();
    const template = await page.evaluate(() => window.restaurantQA().data);
    await kitchen();
    await expect(maple).toContainText('Automatic bonus: +0%');
    await expect(river).toContainText('Unlock Riverside Market first');
    await expect(river.getByRole('button')).toHaveCount(0);
    await page.screenshot({
      path: `test-results/honors-${mobile ? 'mobile' : 'desktop'}-fresh.png`,
      fullPage: true,
    });
    async function restore(level, partial = false) {
      const data = structuredClone(template);
      data.coins = 1e15;
      data.neighborhood.unlockedStreets.push('riverside_market');
      for (const r of Object.values(data.restaurants))
        Object.assign(r, {
          owned: true,
          level,
          register: 0,
          hasManager: false,
        });
      if (partial) data.restaurants.noodle_nook.level = level - 1;
      await button('Settings').click();
      await page
        .getByLabel('Import a saved street')
        .fill(
          JSON.stringify({
            ...data,
            version: 4,
            savedAt: Date.now(),
            pendingOffline: 0,
          }),
        );
      await button('Restore save').click();
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await button('Back to the neighborhood').click();
      await kitchen();
    }
    await restore(50, true);
    await expect(maple).toContainText('5 / 6 at level 50');
    await expect(maple).toContainText('Automatic bonus: +0%');
    await expect(river).toContainText('Automatic bonus: +25%');
    const visit = maple.getByRole('button', { name: 'Visit Noodle Nook' });
    if (mobile) await tap(visit);
    else {
      await visit.focus();
      await page.keyboard.press('Enter');
    }
    await ready();
    await expect(page.locator('.street-sign')).toContainText('MAPLE STREET');
    await tap(page.getByRole('button', { name: /Upgrade restaurant/ }));
    await button('Close restaurant').click();
    await page.waitForFunction(
      () => window.restaurantQA().data.restaurants.noodle_nook.level === 50,
    );
    // Measure real register accrual through the normal clock: 625/s after crossing.
    const sample = () =>
      page.evaluate(() => ({
        t: performance.now(),
        r: window.restaurantQA().data.restaurants.noodle_nook.register,
      }));
    const a = await sample();
    await page.waitForTimeout(1500);
    const b = await sample();
    expect((b.r - a.r) / ((b.t - a.t) / 1000)).toBeGreaterThan(530);
    expect((b.r - a.r) / ((b.t - a.t) / 1000)).toBeLessThan(720);
    await kitchen();
    await expect(maple).toContainText('Automatic bonus: +25%');
    await expect(river).toContainText('Automatic bonus: +25%');
    await tap(river.getByRole('button', { name: 'Visit River Grill' }));
    await ready();
    await expect(page.locator('.street-sign')).toContainText(
      'RIVERSIDE MARKET',
    );
    await button('Close restaurant').click();
    await restore(50);
    await expect(maple).toContainText('6 / 6 at level 50');
    await restore(100);
    await expect(maple).toContainText('Fully complete');
    await expect(river).toContainText('Automatic bonus: +50%');
    await expect(maple.getByRole('button')).toHaveCount(0);
    await page.screenshot({
      path: `test-results/honors-${mobile ? 'mobile' : 'desktop'}-imported-fixture-complete.png`,
      fullPage: true,
    });
    await button('Settings').click();
    await button('Copy / download save').click();
    const exported = JSON.parse(
      await page.evaluate(() => navigator.clipboard.readText()),
    );
    expect(exported.version).toBe(4);
    expect(exported.restaurants.noodle_nook.level).toBe(100);
    expect(Object.keys(exported).sort()).toEqual([
      'boostUntil',
      'coins',
      'gems',
      'neighborhood',
      'pendingOffline',
      'restaurants',
      'savedAt',
      'upgrades',
      'version',
    ]);
    await button('Back to the neighborhood').click();
    await page.reload();
    await ready();
    await kitchen();
    await expect(maple).toContainText('Fully complete');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await button('Settings').click();
    await button('Reset my street').click();
    await button('Yes, start fresh').click();
    await kitchen();
    await expect(maple).toContainText('Automatic bonus: +0%');
    expect(errors).toEqual([]);
    console.log(
      `PASS honors ${mobile ? 'mobile' : 'desktop'} supported fixtures, threshold upgrade/rate, routing, export/reload/reset, overflow/pageerrors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
