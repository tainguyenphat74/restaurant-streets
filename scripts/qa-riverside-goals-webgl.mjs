import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to stable production preview or live URL');
await mkdir('test-results', { recursive: true });
// Fresh normal-motion WebGL, no imports or clock overrides. Emulated touch only.
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
      const goal = page.getByRole('region', {
        name: 'Riverside Market',
        exact: true,
      });
      const filter = goal.getByRole('checkbox', {
        name: 'Hide completed unlock goals',
        exact: true,
      });
      await activate(filter.locator('..'));
      await expect(filter).toBeChecked();
      await expect(goal.getByRole('listitem')).toHaveCount(6);
      await activate(
        goal.getByRole('button', { name: 'Visit Noodle Nook', exact: true }),
      );
      await expect(
        page.getByRole('heading', { name: 'Noodle Nook · Lv 1', exact: true }),
      ).toBeFocused();
      await activate(page.getByRole('button', { name: /^Upgrade restaurant/ }));
      await expect(
        page.getByRole('heading', { name: 'Noodle Nook · Lv 2', exact: true }),
      ).toBeVisible();
      await activate(button('Close restaurant'));
      await expect(filter).toBeChecked();
      const progress = goal.getByRole('progressbar', {
        name: 'Noodle Nook unlock goal progress',
        exact: true,
      });
      await expect(progress).toHaveJSProperty('value', 2);
      await expect(progress).toHaveJSProperty('max', 25);
      await progress.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.screenshot({
        path: `test-results/riverside-goals-earned-${mobile ? 'mobile' : 'desktop'}-WebGL.png`,
      });
      await expect(button('Unlock Riverside Market')).toBeDisabled();
      await page.reload();
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      expect(
        (await page.evaluate(() => window.restaurantQA().data)).restaurants
          .noodle_nook.level,
      ).toBe(2);
      await activate(button('Kitchen'));
      await expect(filter).not.toBeChecked();
      await expect(progress).toHaveJSProperty('value', 2);
      expect(errors).toEqual([]);
      console.log(
        `PASS fresh WebGL Riverside goal ${mobile ? 'mobile' : 'desktop'}: earned collection/upgrade, local filter, native progress update, Visit and reload`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
