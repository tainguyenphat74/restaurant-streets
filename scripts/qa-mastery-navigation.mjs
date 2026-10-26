import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to stable production preview or live URL');
// Supported imported Canvas fixtures with frozen time, not fresh real-time
// WebGL gameplay, physical-device or screen-reader acceptance. No store writes,
// injected toggle events, programmatic focus or custom keyboard handling.
const streets = [
  [
    'Maple Street',
    [
      'noodle_nook',
      'coffee_corner',
      'sunny_bakery',
      'taco_tuesday',
      'tomato_basil',
      'sushi_station',
    ],
  ],
  ['Riverside Market', ['river_grill', 'market_gelato']],
];
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [667, 320],
  ]) {
    const mobile = width !== 1440;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const overview = page.getByRole('region', {
        name: 'Kitchen mastery',
        exact: true,
      });
      const region = (i) =>
        overview.getByRole('region', {
          name: `${streets[i][0]} mastery`,
          exact: true,
        });
      // Accept details as the region itself or nested within the existing region.
      const details = (i) =>
        region(i)
          .locator('details')
          .or(region(i).and(page.locator('details')));
      const summary = (i) => details(i).locator(':scope > summary');
      const filter = overview.getByRole('checkbox', {
        name: 'Hide completed restaurants',
        exact: true,
      });
      const order = overview.getByRole('checkbox', {
        name: 'Nearest next badge first',
        exact: true,
      });
      const names = [
        [
          'Noodle Nook',
          'Coffee Corner',
          'Sunny Bakery',
          'Taco Tuesday',
          'Tomato & Basil',
          'Sushi Station',
        ],
        ['River Grill', 'Market Gelato'],
      ];
      async function ordered(i, indices) {
        // DOM order remains testable while native details are closed.
        await expect(region(i).locator('li strong')).toHaveText(
          indices.map((n) => names[i][n]),
        );
      }
      async function frames() {
        await page.clock.runFor(1000);
        await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      }
      async function exported() {
        await ui(button('Settings'));
        await ui(button('Copy / download save'));
        await expect(
          page
            .getByRole('status')
            .filter({ hasText: 'Save copied to clipboard.' }),
        ).toBeVisible();
        const save = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        await ui(button('Back to the neighborhood'));
        return save;
      }
      async function restore(save) {
        const handles = await Promise.all([
          overview.elementHandle(),
          details(0).elementHandle(),
          details(1).elementHandle(),
        ]);
        await ui(button('Settings'));
        await page
          .getByLabel('Import a saved street')
          .fill(JSON.stringify(save));
        await ui(button('Restore save'));
        await expect(
          page.getByText('Street restored.', { exact: true }),
        ).toBeVisible();
        await ui(button('Back to the neighborhood'));
        for (let i = 0; i < handles.length; i++) {
          const current = i === 0 ? overview : details(i - 1);
          expect(
            await current.evaluate((el, old) => el === old, handles[i]),
          ).toBe(true);
          await handles[i].dispose();
        }
        expect(await exported()).toEqual(save);
      }
      async function state(i, open) {
        await expect
          .poll(() => details(i).evaluate((el) => el.open))
          .toBe(open);
        await expect(summary(i)).toBeVisible();
        // Check rendered copy rather than hidden CSS alternatives in textContent.
        expect(await summary(i).innerText()).toMatch(
          open ? /hide.*restaurants/i : /show.*restaurants/i,
        );
        if (!open) await expect(region(i).getByRole('listitem')).toHaveCount(0);
      }
      async function layout(target) {
        await target.evaluate((el) => {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          // Center in the actually usable viewport below the fixed header.
          const header = document
            .querySelector('.topbar')
            .getBoundingClientRect();
          const rect = el.getBoundingClientRect();
          const top =
            header.bottom + (innerHeight - header.bottom - rect.height) / 2;
          window.scrollBy({ top: rect.top - top, behavior: 'instant' });
        });
        const rect = await target.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(
          await page
            .locator('.topbar')
            .evaluate((el) => el.getBoundingClientRect().bottom),
        );
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height);
        expect(
          await target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [
              [0.1, 0.1],
              [0.9, 0.1],
              [0.5, 0.5],
              [0.1, 0.9],
              [0.9, 0.9],
            ].every(([x, y]) =>
              el.contains(
                document.elementFromPoint(
                  r.x + r.width * x,
                  r.y + r.height * y,
                ),
              ),
            );
          }),
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          await overview.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        return rect;
      }
      async function tabTo(target) {
        for (let n = 0; n < 100; n++) {
          if (await target.evaluate((el) => el === document.activeElement))
            break;
          await page.keyboard.press('Tab');
        }
        await expect(target).toBeFocused();
      }
      async function toggle(i, open, key = 'Space') {
        const target = summary(i);
        const rect = await layout(target);
        if (mobile) {
          await page.touchscreen.tap(
            rect.x + rect.width * 0.9,
            rect.y + rect.height * 0.5,
          );
        } else {
          await tabTo(target);
          expect(
            await target.evaluate((el) => {
              const s = getComputedStyle(el);
              return (
                el.matches(':focus-visible') &&
                ((s.outlineStyle !== 'none' &&
                  parseFloat(s.outlineWidth) > 0 &&
                  s.outlineColor !== 'rgba(0, 0, 0, 0)') ||
                  s.boxShadow !== 'none')
              );
            }),
            'Keyboard focus has a visible outline or shadow',
          ).toBe(true);
          await page.keyboard.press(key);
        }
        await state(i, open);
      }
      await page.clock.install({ time: new Date('2026-10-25T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-25T12:00:00Z'));
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const initial = await exported();
      await ui(button('Kitchen'));
      const search = overview.getByLabel('Search restaurants', { exact: true });
      const clear = overview.getByRole('button', {
        name: 'Clear search',
        exact: true,
      });
      // Establish the existing search before importing navigation fixtures.
      await expect(
        search,
        'Labeled native restaurant search input',
      ).toHaveCount(1);
      expect(
        await search.evaluate((el) => el instanceof HTMLInputElement),
      ).toBe(true);
      await expect(search).toHaveAttribute('type', 'search');
      await expect(search).toHaveValue('');
      await expect(clear).toHaveCount(0);

      async function visibleFocus(target) {
        expect(
          await target.evaluate((el) => {
            const s = getComputedStyle(el);
            return (
              el.matches(':focus-visible') &&
              ((s.outlineStyle !== 'none' &&
                parseFloat(s.outlineWidth) > 0 &&
                s.outlineColor !== 'rgba(0, 0, 0, 0)') ||
                s.boxShadow !== 'none')
            );
          }),
          'New search controls paint visible keyboard focus',
        ).toBe(true);
      }
      async function query(value) {
        const rect = await layout(search);
        if (mobile)
          await page.touchscreen.tap(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
        else {
          await tabTo(search);
          await visibleFocus(search);
        }
        await expect(search).toBeFocused();
        await page.keyboard.press('ControlOrMeta+A');
        await page.keyboard.press('Backspace');
        if (value) await page.keyboard.type(value);
        await expect(search).toHaveValue(value);
        if (value) await layout(clear);
        else await expect(clear).toHaveCount(0);
      }
      const navigation = overview.getByRole('navigation', {
        name: 'Mastery street shortcuts',
        exact: true,
      });
      const shortcut = (i) =>
        navigation.getByRole('link', {
          name: `${streets[i][0]} mastery`,
          exact: true,
        });
      const back = (i) =>
        details(i).getByRole('link', {
          name: 'Back to mastery search',
          exact: true,
        });
      const originalUrl = page.url();
      async function usable(target) {
        // No test scrolling here: this measures the application's destination.
        const rect = await target.boundingBox();
        const bottom = await page
          .locator('.topbar')
          .evaluate((el) => el.getBoundingClientRect().bottom);
        expect(rect.y).toBeGreaterThanOrEqual(bottom);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height);
        expect(
          await target.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
        ).toBe(true);
      }
      async function activate(target, point = [0.5, 0.5]) {
        expect(
          await target.evaluate((el) => el instanceof HTMLAnchorElement),
        ).toBe(true);
        await expect(target).not.toHaveAttribute('aria-current', /.+/);
        const href = await target.getAttribute('href');
        expect(href).toMatch(/^#[a-z][a-z0-9_-]+$/i);
        await expect(page.locator(href)).toHaveCount(1);
        const rect = await layout(target);
        if (mobile)
          await page.touchscreen.tap(
            rect.x + rect.width * point[0],
            rect.y + rect.height * point[1],
          );
        else {
          await tabTo(target);
          await visibleFocus(target);
          await page.keyboard.press('Enter');
        }
        expect(page.url()).toBe(originalUrl);
        await expect(overview).toBeVisible();
      }
      async function navigate(i, point) {
        const otherOpen = await details(1 - i).evaluate((el) => el.open);
        const rows = await overview.locator('li').elementHandles();
        await activate(shortcut(i), point);
        await state(i, true);
        await state(1 - i, otherOpen);
        await expect(summary(i)).toBeFocused();
        await usable(summary(i));
        if (!mobile) await visibleFocus(summary(i));
        for (const row of rows) {
          expect(await row.evaluate((el) => el.isConnected)).toBe(true);
          await row.dispose();
        }
      }
      async function returnToSearch(i, point) {
        const opens = await Promise.all(
          [0, 1].map((n) => details(n).evaluate((el) => el.open)),
        );
        await activate(back(i), point);
        await expect(search).toBeFocused();
        await usable(search);
        if (!mobile) await visibleFocus(search);
        for (const n of [0, 1]) await state(n, opens[n]);
      }
      // Locked fixture is a supported round trip, with an owned starter.
      await restore(initial);
      await toggle(0, false);
      await toggle(1, false);
      console.log(
        `READY navigation regression ${width}x${height}: boot and exact supported fixture import/export succeeded`,
      );
      await expect(
        navigation,
        'Named native Mastery street shortcuts navigation',
      ).toHaveCount(1);
      await expect(navigation).toHaveJSProperty('tagName', 'NAV');
      const points = [
        [0.1, 0.1],
        [0.9, 0.1],
        [0.5, 0.5],
        [0.1, 0.9],
        [0.9, 0.9],
      ];
      for (const point of points) {
        await navigate(1, point);
        await expect(summary(1)).toContainText('Locked');
        await expect(
          region(1).getByRole('button', { name: /^Visit/ }),
        ).toHaveCount(0);
        await returnToSearch(1, point);
        await toggle(1, false);
        await navigate(0, point);
        await returnToSearch(0, point);
        await toggle(0, false);
      }
      expect(await exported()).toEqual(initial);
      const partial = structuredClone(initial);
      [100, 50, 25, 25, 25, 99].forEach((level, i) =>
        Object.assign(partial.restaurants[streets[0][1][i]], {
          owned: true,
          level,
        }),
      );
      partial.neighborhood.unlockedStreets = [
        'maple_street',
        'riverside_market',
      ];
      await restore(partial);
      await query('o');
      await ui(filter);
      await ui(order);
      await ordered(0, [5, 3, 4, 1]);
      await ordered(1, [1]);
      await navigate(1);
      await returnToSearch(1);
      await navigate(0);
      await returnToSearch(0);
      await ordered(0, [5, 3, 4, 1]);
      await expect(search).toHaveValue('o');
      await expect(filter).toBeChecked();
      await expect(order).toBeChecked();
      await toggle(0, false);
      const row = await region(0).locator('li').first().elementHandle();
      const advanced = structuredClone(partial);
      advanced.restaurants.coffee_corner.level = 100;
      await restore(advanced);
      expect(await row.evaluate((el) => el.isConnected)).toBe(true);
      await row.dispose();
      await state(0, false);
      await state(1, true);
      await expect(search).toHaveValue('o');
      await expect(filter).toBeChecked();
      await expect(order).toBeChecked();
      await ordered(0, [5, 3, 4]);
      await query('no-match');
      await navigate(0);
      await returnToSearch(0);
      await navigate(1);
      await expect(overview.locator('li')).toHaveCount(0);
      await page.screenshot({
        path: `test-results/mastery-navigation-${width}x${height}-imported-Canvas-fixture.png`,
      });
      await returnToSearch(1);
      await expect(search).toHaveValue('no-match');
      await expect(filter).toBeChecked();
      await expect(order).toBeChecked();
      expect(await exported()).toEqual(advanced);
      async function defaults() {
        await expect(search).toHaveValue('');
        await expect(filter).not.toBeChecked();
        await expect(order).not.toBeChecked();
        for (const i of [0, 1]) await state(i, true);
        await ordered(0, [0, 1, 2, 3, 4, 5]);
        await ordered(1, [0, 1]);
      }
      await ui(button('Upgrades'));
      await ui(button('Kitchen'));
      await defaults();
      await query('no-match');
      await ui(filter);
      await ui(order);
      await toggle(0, false);
      await page.reload();
      await frames();
      expect(await exported()).toEqual(advanced);
      await ui(button('Kitchen'));
      await defaults();
      expect(page.url()).toBe(originalUrl);
      expect(errors).toEqual([]);
      console.log(
        `PASS mastery navigation ${width}x${height}: native keyboard/touch, targets/focus/scroll, locked inspection, retained local view and exact exports; imported frozen Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
