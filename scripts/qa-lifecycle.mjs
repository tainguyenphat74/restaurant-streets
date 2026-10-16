import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = process.env.QA_URL || 'http://localhost:5173';
  await page.route('**/assets/manifest.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue().catch(() => {});
  });
  await page.goto(base + '/?qa=1', { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Kitchen', exact: true })
      .click();
    await page
      .getByRole('navigation')
      .getByRole('button', { name: 'Street', exact: true })
      .click();
  }
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  const canvas = page.locator('canvas');
  expect(await canvas.count()).toBe(1);
  const view = await canvas.boundingBox();
  const camera = await page.evaluate(() => window.restaurantQA().scene);
  await page.mouse.click(
    view.x +
      (-64 - camera.scrollX - view.width / 2) * camera.zoom +
      view.width / 2,
    view.y +
      (200 - camera.scrollY - view.height / 2) * camera.zoom +
      view.height / 2,
  );
  await expect(
    page.getByRole('complementary', { name: 'Noodle Nook' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close restaurant' }).click();
  const style = await page
    .locator('.currency-number')
    .first()
    .evaluate((e) => getComputedStyle(e).animationName);
  expect(style).toBe('none');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import a saved street').fill('{bad');
  await page.getByRole('button', { name: 'Restore save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Invalid or unsupported' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const fixture = await page.evaluate(() => window.restaurantQA().data);
  delete fixture.neighborhood; // Historical v1/v2 schema excludes v3 fields.
  delete fixture.restaurants.river_grill;
  delete fixture.restaurants.market_gelato;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import a saved street').fill(
    JSON.stringify({
      ...fixture,
      version: 1,
      savedAt: 0,
      pendingOffline: 75,
    }),
  );
  await page.getByRole('button', { name: 'Restore save' }).click();
  await page.getByRole('button', { name: 'Back to the neighborhood' }).click();
  await expect(
    page.getByRole('button', { name: 'Collect earnings', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  expect(await page.evaluate(() => window.restaurantQA().pending)).toBe(75);
  await page
    .getByRole('button', { name: 'Collect earnings', exact: true })
    .click();
  await page.reload();
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  expect(await page.evaluate(() => window.restaurantQA().pending)).toBe(0);
  expect(await page.evaluate(() => window.restaurantQA().data.coins)).toBe(
    fixture.coins + 75,
  );
  expect(errors).toEqual([]);
  await context.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('Storage blocked for QA');
      },
    }),
  );
  const bp = await blocked.newPage();
  await bp.goto(base, { waitUntil: 'domcontentloaded' });
  await expect(
    bp.getByRole('status').filter({ hasText: 'Saving paused' }),
  ).toBeVisible();
  await bp.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(bp.getByRole('alert')).toContainText(
    'Browser storage is unavailable',
  );
  await expect(bp.getByRole('alert')).toContainText(
    'saving and export are paused',
  );
  await blocked.close();
  console.log(
    'PASS: reduced motion, rapid tab teardown during asset fetch, single canvas, canvas building selection, invalid import, Escape, imported pending reward/refresh/claim, blocked storage.',
  );
} finally {
  await browser.close();
}
