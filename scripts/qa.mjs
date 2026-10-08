import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const errors = [];
async function fresh(width, height, touch = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    hasTouch: touch,
    isMobile: touch,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error('PAGE ERROR', e.message);
  });
  await page.goto(`${process.env.QA_URL || 'http://localhost:5173'}/?qa=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  return { page, context };
}
const snap = async (p) => {
  await p.waitForFunction(() => window.restaurantQA?.().scene.ready);
  return p.evaluate(() => window.restaurantQA());
};
const { page, context } = await fresh(1440, 900);
await page.screenshot({ path: 'test-results/desktop-fresh.png' });
await expect(
  page.getByRole('button', { name: 'Collect from Noodle Nook' }),
).toBeVisible();
console.log('Fresh desktop rendered');
// Real-time fresh progress: earn, collect, upgrade. No clock or state writes.
await page.waitForTimeout(14500);
await page.getByRole('button', { name: 'Collect from Noodle Nook' }).click();
await page.getByRole('button', { name: /Noodle Nook Lv/ }).click();
await page.getByRole('button', { name: /Upgrade restaurant/ }).click();
expect((await snap(page)).data.restaurants.noodle_nook.level).toBe(2);
await page.getByRole('button', { name: 'Close restaurant' }).click();
await page.screenshot({ path: 'test-results/desktop-progress.png' });
console.log('Fresh upgrade passed');
const before = (await snap(page)).scene;
await page.mouse.move(750, 480);
await page.mouse.down();
await page.mouse.move(880, 530, { steps: 10 });
await page.mouse.up();
expect((await snap(page)).scene.scrollX).not.toBe(before.scrollX);
expect(await page.locator('.restaurant-panel').count()).toBe(0);
await page.mouse.wheel(0, -200);
await page.waitForTimeout(300);
expect((await snap(page)).scene.zoom).toBeGreaterThan(before.zoom);
await page.getByRole('button', { name: 'Recenter map' }).click();
for (const name of ['Kitchen', 'Upgrades', 'Rankings', 'Street'])
  await page
    .getByRole('navigation')
    .getByRole('button', { name, exact: true })
    .click();
await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
expect((await snap(page)).data.restaurants.noodle_nook.level).toBe(2);
console.log('Desktop gestures, tabs and reload passed');
// Advanced state is explicitly imported through the supported UI; never used for screenshots.
const fixture = (await snap(page)).data;
fixture.coins = 2000;
fixture.gems = 10;
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page
  .getByLabel('Import a saved street')
  .fill(JSON.stringify({ ...fixture, version: 1, savedAt: Date.now() }));
await page.getByRole('button', { name: 'Restore save' }).click();
await page.getByRole('button', { name: 'Back to the neighborhood' }).click();
await page
  .getByRole('button', { name: /For Sale.*100/, exact: false })
  .first()
  .click();
await page.getByRole('button', { name: /Buy restaurant/ }).click();
expect((await snap(page)).data.restaurants.coffee_corner.owned).toBe(true);
await page.getByRole('button', { name: 'Close restaurant' }).click();
await page
  .getByRole('navigation')
  .getByRole('button', { name: 'Kitchen', exact: true })
  .click();
await page.getByRole('button', { name: /Hire manager.*500/ }).click();
await page
  .getByRole('navigation')
  .getByRole('button', { name: 'Street', exact: true })
  .click();
await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
console.log('Purchase and manager passed');
const managed = await snap(page);
await page.waitForTimeout(1200);
expect((await snap(page)).data.coins).toBeGreaterThan(managed.data.coins);
expect((await snap(page)).data.restaurants.noodle_nook.register).toBe(0);
await page.close();
await new Promise((r) => setTimeout(r, 2000));
const reload = await context.newPage();
await reload.goto(`${process.env.QA_URL || 'http://localhost:5173'}/?qa=1`, {
  waitUntil: 'domcontentloaded',
});
await expect(
  reload.getByRole('button', { name: 'Collect earnings', exact: true }),
).toBeVisible();
await reload
  .getByRole('button', { name: 'Collect earnings', exact: true })
  .click();
await reload.waitForFunction(() => window.restaurantQA?.().scene.ready);
expect((await snap(reload)).pending).toBe(0);
await reload.reload({ waitUntil: 'domcontentloaded' });
await reload.waitForFunction(() => window.restaurantQA?.().scene.ready);
expect((await snap(reload)).pending).toBeLessThan(1);
console.log('Offline and reload passed');
await context.close();
const { page: mobile, context: mc } = await fresh(390, 844, true);
await mobile.screenshot({ path: 'test-results/mobile-fresh.png' });
expect(await mobile.evaluate(() => document.documentElement.scrollWidth)).toBe(
  390,
);
await expect(
  mobile.getByRole('button', { name: /Noodle Nook Lv/ }),
).toBeVisible();
console.log('Fresh mobile rendered');
const client = await mc.newCDPSession(mobile);
const touch = async (type, points) =>
  client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([id, x, y]) => ({ id, x, y })),
  });
const initial = (await snap(mobile)).scene;
await touch('touchStart', [
  [1, 120, 430],
  [2, 250, 430],
]);
await touch('touchMove', [
  [1, 90, 430],
  [2, 280, 430],
]);
await mobile.waitForTimeout(100);
expect((await snap(mobile)).scene.zoom).toBeGreaterThan(initial.zoom);
await touch('touchEnd', [[1, 90, 430]]);
const lifted = (await snap(mobile)).scene;
await touch('touchMove', [[1, 95, 435]]);
await mobile.waitForTimeout(100);
const moved = (await snap(mobile)).scene;
expect(Math.abs(moved.scrollX - lifted.scrollX)).toBeLessThan(25);
await touch('touchEnd', []);
expect(await mobile.locator('.restaurant-panel').count()).toBe(0);
await mobile.getByRole('button', { name: 'Recenter map' }).click();
await mobile.getByRole('button', { name: /Noodle Nook Lv/ }).click();
await expect(
  mobile.getByRole('button', { name: /Upgrade restaurant/ }),
).toBeVisible();
await mobile.screenshot({ path: 'test-results/mobile-panel.png' });
await mobile.getByRole('button', { name: 'Close restaurant' }).click();
for (const name of ['Kitchen', 'Upgrades', 'Rankings', 'Street'])
  await mobile
    .getByRole('navigation')
    .getByRole('button', { name, exact: true })
    .click();
await mc.close();
await browser.close();
expect(errors).toEqual([]);
console.log(
  'PASS: desktop/mobile fresh progress, collection, upgrade, purchase, manager, auto-collection, reload, offline claim, tabs, pan, wheel, pinch, release, no drag selection; zero page errors.',
);
