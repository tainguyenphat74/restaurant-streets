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
      // Keep fixtures valid at the real strict import boundary: owned starter,
      // all six Maple >=25 before Riverside, no synthetic store mutations.
      const partial = structuredClone(initial);
      Object.assign(partial, {
        coins: 123456.25,
        gems: 42,
        upgrades: ['ingredients'],
        boostUntil: initial.savedAt + 300000,
      });
      [100, 50, 25, 25, 25, 99].forEach((level, i) =>
        Object.assign(partial.restaurants[streets[0][1][i]], {
          owned: true,
          level,
        }),
      );
      // A managed zero register avoids the intentional sweep even at zero time.
      Object.assign(partial.restaurants.noodle_nook, {
        hasManager: true,
        register: 0,
      });
      // Positive pendingOffline opens a blocking reward modal after Settings.
      partial.neighborhood.unlockedStreets = [
        'maple_street',
        'riverside_market',
      ];
      Object.assign(partial.restaurants.river_grill, {
        owned: true,
        level: 100,
        register: 123.125,
      });
      const reset = overview.getByRole('button', {
        name: 'Reset mastery view',
        exact: true,
      });
      async function results(counts, save) {
        for (const i of [0, 1]) {
          await expect(region(i).getByRole('status')).toHaveText(
            `Showing ${counts[i]} of ${streets[i][1].length} restaurants`,
          );
          await expect(region(i).locator('li')).toHaveCount(counts[i]);
        }
        await summaries(save);
      }
      async function defaults(save, focused = true) {
        await expect(search).toHaveValue('');
        await expect(badge).toHaveValue('all');
        await expect(filter).not.toBeChecked();
        await expect(order).not.toBeChecked();
        await expect(reset).toHaveCount(0);
        await expect(clear).toHaveCount(0);
        if (focused) await expect(search).toBeFocused();
        await ordered(0, [0, 1, 2, 3, 4, 5]);
        await ordered(1, [0, 1]);
        await results([6, 2], save);
      }
      async function resetView(save, point = [0.5, 0.5], key = 'Enter') {
        await expect(
          reset,
          'Explicit native Reset mastery view button',
        ).toHaveCount(1);
        expect(
          await reset.evaluate((el) => el instanceof HTMLButtonElement),
        ).toBe(true);
        await expect(reset).toHaveAttribute('type', 'button');
        const rect = await layout(reset);
        await retained(async () => {
          if (mobile)
            await page.touchscreen.tap(
              rect.x + rect.width * point[0],
              rect.y + rect.height * point[1],
            );
          else {
            await tabTo(reset);
            await visibleFocus(reset);
            await page.keyboard.press(key);
          }
        });
        await defaults(save);
        expect(await exported()).toEqual(save);
      }

      const badge = overview.getByRole('combobox', {
        name: 'Next badge',
        exact: true,
      });
      // Prove boot and strict supported import/export before missing-feature RED.
      await restore(partial);
      console.log(
        `READY badge regression ${width}x${height}: boot and exact supported Restore/export succeeded`,
      );
      await expect(
        badge,
        'Native Next badge select is present after successful import',
      ).toHaveCount(1);
      expect(
        await badge.evaluate((el) => el instanceof HTMLSelectElement),
      ).toBe(true);
      await expect(badge.locator('option')).toHaveText([
        'All badges',
        'Apprentice',
        'Artisan',
        'Master',
      ]);
      await expect(overview).toContainText(
        'Filter by the next unearned badge, not badges already earned.',
      );
      async function choose(value) {
        const rect = await layout(badge);
        if (mobile) {
          await retained(async () => {
            await page.touchscreen.tap(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            );
            // Native popup choices are OS-owned; Playwright's supported select API.
            await badge.selectOption(value);
            await page.keyboard.press('Escape');
          });
        } else {
          await tabTo(badge);
          await visibleFocus(badge);
          // Each native selection can remove rows and later re-add them.
          // Only rows surviving that individual change must retain identity.
          await retained(() => page.keyboard.press('Home'));
          const index = ['all', 'Apprentice', 'Artisan', 'Master'].indexOf(
            value,
          );
          for (let n = 0; n < index; n++)
            await retained(() => page.keyboard.press('ArrowDown'));
          await retained(() => page.keyboard.press('Enter'));
        }
        await expect(badge).toHaveValue(value);
      }
      await defaults(partial, false);
      await toggle(1, false);
      await choose('Master');
      await ordered(0, [1, 5]);
      await results([2, 0], partial);
      await resetView(partial); // Badge alone must expose/reset the control.
      await state(1, false);

      // Locked street with valid owned starter; every Maple threshold.
      const locked = structuredClone(initial);
      [24, 25, 49, 50, 99, 100].forEach((level, i) =>
        Object.assign(locked.restaurants[streets[0][1][i]], {
          owned: true,
          level,
        }),
      );
      await restore(locked);
      for (const [value, maple, river] of [
        ['Apprentice', [0], [0, 1]],
        ['Artisan', [1, 2], []],
        ['Master', [3, 4], []],
        ['all', [0, 1, 2, 3, 4, 5], [0, 1]],
      ]) {
        await choose(value);
        await ordered(0, maple);
        await ordered(1, river);
        await results([maple.length, river.length], locked);
        await expect(region(1).getByRole('button')).toHaveCount(0);
      }
      await choose('Apprentice');
      await ui(filter);
      await ui(order);
      await query(' NOODLE ');
      await results([1, 0], locked);
      await resetView(locked);

      // Hold the mounted badge selection fixed across Restore in both directions.
      // All Maple levels stay >=25, preserving strict Riverside unlock validity.
      for (const [low, high, values] of [
        [24, 25, ['Apprentice', 'Artisan']],
        [49, 50, ['Artisan', 'Master']],
        [99, 100, ['Master']],
      ]) {
        for (const value of values) {
          await choose(value);
          for (const level of [low, high, low]) {
            const boundary = structuredClone(partial);
            Object.assign(boundary.restaurants.river_grill, {
              owned: true,
              level,
              register: 0,
            });
            await retained(() => restore(boundary));
            // Assert membership before any further selection interaction.
            await expect(badge).toHaveValue(value);
            const next =
              level < 25
                ? 'Apprentice'
                : level < 50
                  ? 'Artisan'
                  : level < 100
                    ? 'Master'
                    : '';
            const maple =
              value === 'Apprentice'
                ? []
                : value === 'Artisan'
                  ? [2, 3, 4]
                  : [1, 5];
            const river = value === 'Apprentice' ? [1] : [];
            if (next === value) river.unshift(0);
            await ordered(0, maple);
            await ordered(1, river);
            await results([maple.length, river.length], boundary);
          }
        }
      }

      // Unlocked Riverside accepts all seven boundaries through normal Restore.
      for (const level of [0, 24, 25, 49, 50, 99, 100]) {
        const boundary = structuredClone(partial);
        Object.assign(boundary.restaurants.river_grill, {
          owned: level > 0,
          level,
          register: 0,
        });
        await restore(boundary);
        for (const value of ['Apprentice', 'Artisan', 'Master']) {
          await choose(value);
          const next =
            level < 25
              ? 'Apprentice'
              : level < 50
                ? 'Artisan'
                : level < 100
                  ? 'Master'
                  : '';
          const expected =
            value === 'Apprentice'
              ? next === value
                ? [0, 1]
                : [1]
              : next === value
                ? [0]
                : [];
          await ordered(1, expected);
          await summaries(boundary);
        }
      }
      await restore(partial);
      await choose('Master');
      await ui(order);
      await ordered(0, [5, 1]);
      await state(0, true);
      await state(1, false);
      const closer = structuredClone(partial);
      closer.restaurants.coffee_corner.level = 99;
      await retained(() => restore(closer));
      await expect(badge).toHaveValue('Master');
      await ordered(0, [1, 5]);
      await results([2, 0], closer);
      await retained(() => restore(partial));
      await expect(badge).toHaveValue('Master');
      await ordered(0, [5, 1]);
      await ui(filter);
      await query(' COFFEE ');
      await ordered(0, [1]);
      await results([1, 0], partial);
      await query('missing');
      await results([0, 0], partial);
      await expect(region(0)).toContainText(
        'No restaurants match the selected next badge and search.',
      );
      await resetView(partial);
      await choose('Apprentice'); // No Maple Apprentice target; Maple is not all mastered.
      await results([0, 1], partial);
      await expect(region(0)).toContainText(
        'No restaurants have Apprentice as their next badge.',
      );
      await expect(region(0)).not.toContainText('All restaurants mastered.');
      await toggle(1, true);
      await layout(badge);
      await page.screenshot({
        path: `test-results/mastery-badge-filter-${width}x${height}-imported-Canvas-fixture.png`,
      });
      expect(await exported()).toEqual(partial);
      await ui(button('Street'));
      await ui(button('Kitchen'));
      await defaults(partial, false);
      await choose('Artisan');
      await page.reload();
      await frames();
      expect(await exported()).toEqual(partial);
      await ui(button('Kitchen'));
      await defaults(partial, false);
      for (const i of [0, 1]) await state(i, true);
      expect(errors).toEqual([]);
      console.log(
        `PASS mastery badge filter ${width}x${height}: canonical boundaries, conjunctions, whole counts, mixed/keyed Restore reorder, reset/focus, native keyboard and coordinate touch geometry, exact exports and defaults; imported frozen Canvas fixtures, not fresh gameplay`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
