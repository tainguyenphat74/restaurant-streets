import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
// Exercise Phaser's Canvas fallback for deterministic headless CPU rendering.
// The existing QA scripts also exercise the default WebGL renderer.
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
const base = process.env.QA_URL || 'http://127.0.0.1:5173';
try {
  // Override only network assets; the QA hook remains read-only.
  const spriteContext = await browser.newContext();
  const spritePage = await spriteContext.newPage();
  const spriteErrors = [];
  spritePage.on('pageerror', (e) => spriteErrors.push(e.message));
  await spritePage.route('**/assets/manifest.json', (route) => route.fulfill({
    json: { walker: { file: 'qa-walker.svg', anchorX: 0.25, anchorY: 0.75, scale: 1.5 } },
  }));
  let spriteRequests = 0;
  await spritePage.route('**/assets/qa-walker.svg', (route) => {
    spriteRequests++;
    return route.fulfill({ contentType: 'image/svg+xml', body:
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="32"><rect width="20" height="32" fill="#ff00ff"/></svg>' });
  });
  await spritePage.goto(base + '/?qa=1');
  await spritePage.waitForFunction(() => window.restaurantQA?.().scene.ready);
  await spritePage.waitForTimeout(1000);
  expect(spriteRequests).toBe(1);
  expect(await spritePage.evaluate(() => window.restaurantQA().scene.walkers)).toBe(10);
  await spritePage.screenshot({ path: 'test-results/customers-manifest-walker.png' });
  expect(spriteErrors).toEqual([]);
  await spriteContext.close();
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/?qa=1');
    await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    const scene = () => page.evaluate(() => window.restaurantQA().scene);
    await page.screenshot({
      path: `test-results/customers-${mobile ? 'mobile' : 'desktop'}-fresh.png`,
    });
    await page.waitForFunction(
      () =>
        window.restaurantQA().scene.customers.some((c) => c.phase === 'dine'),
      {},
      { timeout: 60000 },
    );
    await page.waitForFunction(
      () => window.restaurantQA().scene.customers.some((c) => c.exits > 0),
      {},
      { timeout: 60000 },
    );
    expect(
      (await scene()).customers.every(
        (c) => !c.destination || c.destination === 'noodle_nook',
      ),
    ).toBe(true);
    // Genuine progression: dining may finish before the first upgrade is affordable.
    await page.waitForFunction(
      () => window.restaurantQA().data.restaurants.noodle_nook.register >= 12,
      {},
      { timeout: 60000 },
    );
    // Collected only after real-time earnings, never a state or clock write.
    await page
      .getByRole('button', { name: 'Collect from Noodle Nook' })
      .click();
    await page.getByRole('button', { name: /Noodle Nook Lv/ }).click();
    await page.getByRole('button', { name: /Upgrade restaurant/ }).click();
    await page.getByRole('button', { name: 'Close restaurant' }).click();
    expect(
      await page.evaluate(
        () => window.restaurantQA().data.restaurants.noodle_nook.level,
      ),
    ).toBe(2);
    await page.screenshot({
      path: `test-results/customers-${mobile ? 'mobile' : 'desktop'}-progress.png`,
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(200);
    const frozen = (await scene()).customers;
    await page.waitForTimeout(700);
    expect((await scene()).customers).toEqual(frozen);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(700);
    expect((await scene()).customers).not.toEqual(frozen);
    // Explicit supported import UI fixture for purchase/second-side routing only.
    const fixture = await page.evaluate(() => window.restaurantQA().data);
    delete fixture.neighborhood; // Historical v1/v2 schema excludes v3 fields.
    fixture.coins = 4000000;
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page
      .getByLabel('Import a saved street')
      .fill(JSON.stringify({ ...fixture, version: 1, savedAt: Date.now() }));
    await page.getByRole('button', { name: 'Restore save' }).click();
    await page
      .getByRole('button', { name: 'Back to the neighborhood' })
      .click();
    await page
      .getByRole('button', { name: /For Sale.*100/, exact: false })
      .first()
      .click();
    await page.getByRole('button', { name: /Buy restaurant/ }).click();
    await page.getByRole('button', { name: 'Close restaurant' }).click();
    await page.waitForFunction(
      () =>
        window
          .restaurantQA()
          .scene.customers.some((c) => c.destination === 'coffee_corner'),
      {},
      { timeout: 60000 },
    );
    // Buy the remaining shops through the UI; observe the lower-side entrance too.
    while (await page.getByRole('button', { name: /For Sale/ }).count()) {
      await page
        .getByRole('button', { name: /For Sale/ })
        .first()
        .click();
      await page.getByRole('button', { name: /Buy restaurant/ }).click();
      await page.getByRole('button', { name: 'Close restaurant' }).click();
    }
    await page.waitForFunction(
      () =>
        window
          .restaurantQA()
          .scene.customers.some((c) => c.side === 9 && c.phase === 'dine'),
      {},
      { timeout: 60000 },
    );
    const camera = await scene();
    if (mobile) {
      const client = await context.newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { id: 1, x: 120, y: 430 },
          { id: 2, x: 250, y: 430 },
        ],
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { id: 1, x: 90, y: 430 },
          { id: 2, x: 280, y: 430 },
        ],
      });
      await page.waitForTimeout(100);
      expect((await scene()).zoom).toBeGreaterThan(camera.zoom);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
    } else {
      await page.mouse.move(750, 480);
      await page.mouse.down();
      await page.mouse.move(850, 520, { steps: 10 });
      await page.mouse.up();
      expect((await scene()).scrollX).not.toBe(camera.scrollX);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(200);
      expect((await scene()).zoom).toBeGreaterThan(camera.zoom);
    }
    for (const tab of ['Kitchen', 'Street', 'Rankings', 'Street']) {
      await page
        .getByRole('navigation')
        .getByRole('button', { name: tab, exact: true })
        .click();
    }
    await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    expect(await page.locator('canvas').count()).toBe(1);
    expect((await scene()).walkers).toBeLessThanOrEqual(20);
    expect(errors).toEqual([]);
    console.log(
      `PASS ${mobile ? 'mobile' : 'desktop'}: real dining/exit, progress, purchase routing, runtime reduced motion, teardown; zero pageerrors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
