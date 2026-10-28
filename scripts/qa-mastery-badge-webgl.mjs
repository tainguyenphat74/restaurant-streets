import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable preview or live URL');
await mkdir('test-results', { recursive: true });
// Fresh normal-motion WebGL: no imports or controlled clocks. Touch is emulated.
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
      page.on('pageerror', (e) => errors.push(e.message));
      const button = (name) => page.getByRole('button', { name, exact: true });
      const activate = (target) => (mobile ? target.tap() : target.click());
      await page.goto(`${base}/?qa=1`);
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      expect(
        await page
          .locator('canvas')
          .evaluate((c) =>
            Boolean(c.getContext('webgl') || c.getContext('webgl2')),
          ),
      ).toBe(true);
      await page.waitForFunction(
        () => window.restaurantQA().data.restaurants.noodle_nook.register >= 12,
        {},
        { timeout: 60000 },
      );
      await activate(button('Collect from Noodle Nook'));
      await activate(button('Kitchen'));
      const overview = page.getByRole('region', {
        name: 'Kitchen mastery',
        exact: true,
      });
      const filter = overview.getByRole('combobox', {
        name: 'Next badge',
        exact: true,
      });
      await expect(filter).toHaveValue('all');
      await filter.selectOption({ label: 'Artisan' });
      await expect(overview.locator('.mastery-list > li')).toHaveCount(0);
      await filter.selectOption({ label: 'Apprentice' });
      await expect(overview.locator('.mastery-list > li')).toHaveCount(8);
      await expect(
        overview.getByRole('button', {
          name: 'Visit Noodle Nook',
          exact: true,
        }),
      ).toHaveCount(1);
      await filter.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.screenshot({
        path: `test-results/mastery-badge-${mobile ? 'mobile' : 'desktop'}-earned-WebGL.png`,
      });
      await activate(
        overview.getByRole('button', {
          name: 'Visit Noodle Nook',
          exact: true,
        }),
      );
      const before = await page.evaluate(() => window.restaurantQA().data);
      expect(before.coins).toBeGreaterThanOrEqual(11.5);
      await activate(page.getByRole('button', { name: /^Upgrade restaurant/ }));
      const after = await page.evaluate(() => window.restaurantQA().data);
      expect(after.restaurants.noodle_nook.level).toBe(2);
      expect(after.coins).toBe(before.coins - 11.5);
      expect(after.gems).toBe(before.gems);
      await activate(button('Close restaurant'));
      await activate(button('Kitchen'));
      await expect(filter).toHaveValue('all');
      await filter.selectOption({ label: 'Master' });
      await activate(
        overview.getByRole('button', {
          name: 'Reset mastery view',
          exact: true,
        }),
      );
      await expect(filter).toHaveValue('all');
      await expect(
        overview.getByLabel('Search restaurants', { exact: true }),
      ).toBeFocused();
      await filter.selectOption({ label: 'Artisan' });
      await page.reload();
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      // Street owns restaurantQA; read restored progress before unmounting it.
      expect(
        (await page.evaluate(() => window.restaurantQA().data)).restaurants
          .noodle_nook.level,
      ).toBe(2);
      await activate(button('Kitchen'));
      await expect(filter).toHaveValue('all');
      expect(errors).toEqual([]);
      console.log(
        `PASS fresh normal-motion WebGL ${mobile ? 'mobile' : 'desktop'}: native badge filtering, Visit, earned 1→2 exact coins/gems, remount/reset/reload defaults`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
