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
        expect(rect.y).toBeGreaterThanOrEqual(0);
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
      async function summaries(save) {
        for (const [i, [name, ids]] of streets.entries()) {
          let badges = 0,
            complete = 0;
          for (const id of ids) {
            const r = save.restaurants[id];
            const earned = !r.owned
              ? 0
              : r.level >= 100
                ? 3
                : r.level >= 50
                  ? 2
                  : r.level >= 25
                    ? 1
                    : 0;
            badges += earned;
            complete += Number(earned === 3);
          }
          await layout(summary(i));
          const visible = await summary(i).innerText();
          expect(visible).toContain(name);
          expect(visible).toContain(
            `${badges} / ${ids.length * 3} badges earned`,
          );
          expect(visible).toContain(
            `${complete} / ${ids.length} restaurants complete`,
          );
          if (
            i === 1 &&
            !save.neighborhood.unlockedStreets.includes('riverside_market')
          )
            expect(visible).toContain('Locked');
        }
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
      // Behavioral RED only after successful boot and supported full export.
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
      async function activate(target) {
        const rect = await layout(target);
        if (mobile)
          await page.touchscreen.tap(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
        else {
          await tabTo(target);
          await visibleFocus(target);
          await page.keyboard.press('Enter');
        }
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
      async function clearSearch() {
        await activate(clear);
        await expect(search).toBeFocused();
        await expect(search).toHaveValue('');
        await expect(clear).toHaveCount(0);
      }
      async function noResults(i) {
        await ordered(i, []);
        await expect(region(i)).toContainText(/no restaurants match/i);
        await expect(region(i)).not.toContainText('All restaurants mastered.');
      }
      async function retained(action) {
        const ds = await Promise.all([
          details(0).elementHandle(),
          details(1).elementHandle(),
        ]);
        const opens = await Promise.all([
          details(0).evaluate((el) => el.open),
          details(1).evaluate((el) => el.open),
        ]);
        const rows = await overview.locator('li').elementHandles();
        const rowNames = await Promise.all(
          rows.map((r) =>
            r.evaluate((el) => el.querySelector('strong').textContent),
          ),
        );
        await action();
        for (const i of [0, 1]) {
          expect(
            await details(i).evaluate((el, old) => el === old, ds[i]),
          ).toBe(true);
          await state(i, opens[i]);
          await ds[i].dispose();
        }
        const current = await overview.locator('li strong').allTextContents();
        for (let i = 0; i < rows.length; i++) {
          if (current.includes(rowNames[i]))
            expect(await rows[i].evaluate((el) => el.isConnected)).toBe(true);
          await rows[i].dispose();
        }
      }
      await query('  rIvEr  ');
      await noResults(0);
      await ordered(1, [0]);
      await expect(region(1).getByRole('button')).toHaveCount(0);
      await expect(region(1)).toContainText(
        'Own all six Maple restaurants at level 25 to unlock.',
      );
      await summaries(initial);
      await ui(
        overview.getByRole('link', { name: 'View Riverside unlock goal' }),
      );
      await expect(page.locator('#riverside-title')).toBeFocused();
      await expect(button('Unlock Riverside Market')).toBeDisabled();
      expect(await exported()).toEqual(initial);
      await clearSearch();
      await ordered(0, [0, 1, 2, 3, 4, 5]);
      await ordered(1, [0, 1]);

      const partial = structuredClone(initial);
      Object.assign(partial, {
        coins: 123456.25,
        gems: 42,
        upgrades: ['ingredients'],
      });
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
      Object.assign(partial.restaurants.river_grill, {
        owned: true,
        level: 100,
        register: 123.125,
      });
      await restore(partial);
      await toggle(1, false);
      await retained(() => query('o'));
      await ordered(0, [0, 1, 3, 4, 5]);
      await ordered(1, [1]);
      await retained(() => ui(filter));
      await retained(() => ui(order));
      await ordered(0, [5, 3, 4, 1]);
      await ordered(1, [1]);
      await summaries(partial);
      expect(await exported()).toEqual(partial);

      const closer = structuredClone(partial);
      closer.restaurants.coffee_corner.level = 99;
      await retained(() => restore(closer));
      await expect(search).toHaveValue('o');
      await expect(filter).toBeChecked();
      await expect(order).toBeChecked();
      await ordered(0, [1, 5, 3, 4]);
      await expect(
        region(0).getByRole('progressbar', {
          name: 'Coffee Corner progress to Master',
          exact: true,
        }),
      ).toHaveAttribute('value', '99');
      await state(0, true);
      await state(1, false);
      await summaries(closer);
      const advanced = structuredClone(closer);
      advanced.restaurants.coffee_corner.level = 100;
      await retained(() => restore(advanced));
      await expect(search).toHaveValue('o');
      await ordered(0, [5, 3, 4]);
      await summaries(advanced);
      await retained(clearSearch);
      await ordered(0, [5, 2, 3, 4]); // Clear preserves hide-completed and nearest order.
      await ordered(1, [1]);
      await expect(filter).toBeChecked();
      await expect(order).toBeChecked();
      await retained(() => query('   '));
      await ordered(0, [5, 2, 3, 4]);
      await ordered(1, [1]);
      await clearSearch();
      await toggle(1, true);
      for (const value of [
        'noodle_nook',
        'Master',
        'Riverside Market',
        'xyz-no-match',
      ]) {
        await query(value);
        for (const i of [0, 1]) await noResults(i);
        await summaries(advanced);
      }
      await layout(search);
      await page.screenshot({
        path: `test-results/mastery-search-${width}x${height}-controls-imported-Canvas-fixture.png`,
      });
      const complete = structuredClone(advanced);
      Object.values(complete.restaurants).forEach((r) =>
        Object.assign(r, { owned: true, level: 100 }),
      );
      await restore(complete);
      await expect(search).toHaveValue('xyz-no-match');
      for (const i of [0, 1]) await noResults(i);
      await clearSearch();
      for (const i of [0, 1]) {
        await expect(
          region(i).getByText('All restaurants mastered.', { exact: true }),
        ).toBeVisible();
        await ordered(i, []);
      }
      await query('   ');
      for (const i of [0, 1])
        await expect(region(i)).toContainText('All restaurants mastered.');
      await clearSearch();
      await restore(advanced);
      for (const [i, name, streetId, sign] of [
        [1, 'Market Gelato', 'riverside_market', 'RIVERSIDE MARKET'],
        [0, 'Sushi Station', 'maple_street', 'MAPLE STREET'],
      ]) {
        await query(name.toUpperCase());
        await ordered(i, [i === 1 ? 1 : 5]);
        const visit = region(i).getByRole('button', {
          name: `Visit ${name}`,
          exact: true,
        });
        await activate(visit);
        await frames();
        await expect(overview).toHaveCount(0);
        await expect(page.locator('.street-sign')).toContainText(sign);
        await expect(
          page.getByRole('complementary', { name, exact: true }),
        ).toBeVisible();
        await ui(button('Close restaurant'));
        advanced.neighborhood.currentStreet = streetId;
        expect(await exported()).toEqual(advanced);
        await ui(button('Kitchen'));
        await expect(search).toHaveValue('');
        await expect(clear).toHaveCount(0);
        await expect(filter).not.toBeChecked();
        await expect(order).not.toBeChecked();
        for (const j of [0, 1]) await state(j, true);
        await ordered(0, [0, 1, 2, 3, 4, 5]);
        await ordered(1, [0, 1]);
      }
      await query('coffee');
      await ui(filter);
      await ui(order);
      await toggle(0, false);
      expect(await exported()).toEqual(advanced);
      await page.reload();
      await frames();
      expect(await exported()).toEqual(advanced);
      await ui(button('Kitchen'));
      await expect(search).toHaveValue('');
      await expect(clear).toHaveCount(0);
      await expect(filter).not.toBeChecked();
      await expect(order).not.toBeChecked();
      for (const i of [0, 1]) await state(i, true);
      await ordered(0, [0, 1, 2, 3, 4, 5]);
      await ordered(1, [0, 1]);
      await summaries(advanced);
      await layout(search);
      expect(errors).toEqual([]);
      console.log(
        `PASS mastery search ${width}x${height}: native typing/touch, 44px five-point targets, clear focus, name-only matching, filter/order composition, retained rows/mixed disclosures, mounted Restore, whole-catalog summaries, guarded visits, exact exports and defaults; imported frozen Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
