import { chromium, expect } from '@playwright/test';

// Advanced supported-import fixtures, never presented as naturally earned progress.
// Canvas is intentional for deterministic CPU customer/scene stress; qa.mjs covers WebGL.
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to a stable production build');
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-webgl'] });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      hasTouch: mobile, isMobile: mobile, reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const ready = () => page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    const tap = locator => mobile ? locator.tap() : locator.click();
    await page.goto(`${base}/?qa=1`);
    await ready();
    const fixture = await page.evaluate(() => window.restaurantQA().data);
    for (const r of Object.values(fixture.restaurants)) Object.assign(r, { owned: true, level: 25, hasManager: false, register: 0 });
    fixture.neighborhood = { currentStreet: 'riverside_market', unlockedStreets: ['maple_street', 'riverside_market'] };
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Import a saved street').fill(JSON.stringify({ ...fixture, version: 4, pendingOffline: 0, savedAt: Date.now() }));
    await page.getByRole('button', { name: 'Restore save' }).click();
    await expect(page.getByText('Street restored.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to the neighborhood' }).click();
    await ready();
    for (const id of ['river_grill', 'market_gelato']) {
      // Observe the real animation, not clock advancement or writable QA hooks.
      for (const phase of ['queue', 'dine', 'leave']) {
        await page.waitForFunction(({ id, phase }) => window.restaurantQA().scene.customers.some(c => c.destination === id && c.phase === phase), { id, phase }, { timeout: 90000 });
        if (phase === 'queue') await page.screenshot({ path: `test-results/riverside-${id}-${mobile ? 'mobile' : 'desktop'}-imported-fixture.png` });
      }
    }
    expect(await page.evaluate(() => window.restaurantQA().scene.customers.every(c => !c.destination || ['river_grill', 'market_gelato'].includes(c.destination)))).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(200);
    const frozen = await page.evaluate(() => window.restaurantQA().scene.customers);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.restaurantQA().scene.customers)).toEqual(frozen);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (let i = 0; i < 3; i++) {
      await tap(page.getByRole('button', { name: 'Maple Street', exact: true }));
      await ready();
      await expect(page.locator('.building-label')).toHaveCount(6);
      await tap(page.getByRole('button', { name: 'Riverside Market', exact: true }));
      await ready();
      await expect(page.locator('.building-label')).toHaveCount(2);
      await expect(page.locator('canvas')).toHaveCount(1);
    }
    expect(errors).toEqual([]);
    console.log(`PASS ${mobile ? 'mobile' : 'desktop'} Riverside normal-motion customers: both entrances queue/dine/leave, runtime reduced motion, repeated street switching, one canvas, zero page errors (advanced imported fixture; screenshots explicitly labeled imported-fixture).`);
    await context.close();
  }
} finally { await browser.close(); }
