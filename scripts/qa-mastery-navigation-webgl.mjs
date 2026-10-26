import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to stable production preview or live URL');
await mkdir('test-results', { recursive: true });
// Fresh normal-motion WebGL; no imports, injected progress or controlled clocks.
// Chromium touch emulation is not physical-device/virtual-keyboard acceptance.
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
      const originalUrl = page.url();
      await activate(
        page.getByRole('button', { name: 'Kitchen', exact: true }),
      );
      const overview = page.getByRole('region', {
        name: 'Kitchen mastery',
        exact: true,
      });
      const search = overview.getByLabel('Search restaurants', { exact: true });
      await search.fill('no-match');
      const shortcuts = overview.getByRole('navigation', {
        name: 'Mastery street shortcuts',
      });
      for (const name of ['Maple Street', 'Riverside Market']) {
        await activate(
          shortcuts.getByRole('link', { name: `${name} mastery`, exact: true }),
        );
        const region = overview.getByRole('region', {
          name: `${name} mastery`,
          exact: true,
        });
        await expect(region.locator('summary')).toBeFocused();
        if (name === 'Riverside Market')
          await expect(region.locator('summary')).toContainText('Locked');
        await expect(
          region.getByText('No restaurants match search.', { exact: true }),
        ).toBeVisible();
        await activate(
          region.getByRole('link', {
            name: 'Back to mastery search',
            exact: true,
          }),
        );
        await expect(search).toBeFocused();
        await expect(search).toHaveValue('no-match');
        expect(page.url()).toBe(originalUrl);
      }
      await activate(
        overview.getByRole('button', {
          name: 'Reset mastery view',
          exact: true,
        }),
      );
      await expect(search).toBeFocused();
      // Viewport capture avoids a fixed header painted into a tall element crop.
      await shortcuts.evaluate((el) =>
        el.scrollIntoView({ block: 'center', inline: 'nearest' }),
      );
      await page.screenshot({
        path: `test-results/mastery-navigation-${mobile ? 'mobile' : 'desktop'}-fresh-WebGL.png`,
      });
      await activate(
        overview.getByRole('button', {
          name: 'Visit Noodle Nook',
          exact: true,
        }),
      );
      await expect(
        page.getByRole('heading', { name: 'Noodle Nook · Lv 1', exact: true }),
      ).toBeFocused();
      await activate(
        page.getByRole('button', { name: 'Close restaurant', exact: true }),
      );
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      const snapshot = await page.evaluate(() => window.restaurantQA());
      expect(snapshot.data.restaurants.noodle_nook.level).toBe(1);
      expect(snapshot.data.neighborhood.unlockedStreets).toEqual([
        'maple_street',
      ]);
      expect(errors).toEqual([]);
      console.log(
        `Fresh normal-motion WebGL ${mobile ? 'mobile' : 'desktop'}: shortcuts, locked inspection, return search, Reset and actual Noodle Visit PASS`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
