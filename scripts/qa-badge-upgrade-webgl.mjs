import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to a stable production build or live URL');
await mkdir('test-results', { recursive: true });
// Natural earned progress in normal-motion WebGL, no imports/clock overrides.
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const button = (name) => page.getByRole('button', { name, exact: true });
      const activate = (target) => (mobile ? target.tap() : target.click());
      await page.goto(`${base}/?qa=1`);
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      expect(
        await page
          .locator('canvas')
          .evaluate((canvas) =>
            Boolean(canvas.getContext('webgl') || canvas.getContext('webgl2')),
          ),
      ).toBe(true);
      await page.waitForFunction(
        () => window.restaurantQA().data.restaurants.noodle_nook.register >= 12,
        {},
        { timeout: 60000 },
      );
      await activate(button('Collect from Noodle Nook'));
      await activate(page.getByRole('button', { name: /^Noodle Nook Lv/ }));
      await expect(button('Next badge')).toHaveCount(1);
      await expect(button('Buy 1')).toHaveAttribute('aria-pressed', 'true');
      if (mobile) await button('Next badge').tap();
      else {
        await button('Next badge').focus();
        await page.keyboard.press('Enter');
      }
      await expect(button('Next badge')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.locator('.bulk-quote')).toContainText('1 level');
      const before = await page.evaluate(() => window.restaurantQA().data);
      // Fail explicitly if a stalled runner collected beyond the one-level fixture.
      expect(before.coins).toBeGreaterThanOrEqual(11.5);
      expect(before.coins).toBeLessThan(11.5 + 10 * 1.15 ** 2);
      await activate(page.getByRole('button', { name: /^Upgrade restaurant/ }));
      const after = await page.evaluate(() => window.restaurantQA().data);
      expect(before.restaurants.noodle_nook.level).toBe(1);
      expect(after.restaurants.noodle_nook.level).toBe(2);
      expect(after.coins).toBe(before.coins - 11.5);
      expect(after.gems).toBe(before.gems);
      await expect(
        page.getByRole('heading', { name: 'Noodle Nook · Lv 2', exact: true }),
      ).toBeVisible();
      await expect(button('Next badge')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(
        page.getByRole('button', { name: /^Upgrade restaurant/ }),
      ).toBeDisabled();
      await button('Next badge').evaluate((el) =>
        el.scrollIntoView({ block: 'center' }),
      );
      await page.screenshot({
        path: `test-results/badge-upgrade-earned-${mobile ? 'mobile' : 'desktop'}-WebGL.png`,
      });
      await activate(button('Close restaurant'));
      await page.reload();
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      expect(
        (await page.evaluate(() => window.restaurantQA().data)).restaurants
          .noodle_nook.level,
      ).toBe(2);
      await activate(page.getByRole('button', { name: /^Noodle Nook Lv/ }));
      await expect(button('Buy 1')).toHaveAttribute('aria-pressed', 'true');
      await expect(button('Next badge')).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(errors).toEqual([]);
      console.log(
        `PASS fresh WebGL ${mobile ? 'mobile' : 'desktop'}: earned collection, Next badge partial 1→2 purchase, exact coins/gems, disabled insufficient purchase, reload/local mode default`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
