import { chromium, expect } from '@playwright/test';

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
      async function hiddenTabOrder() {
        // Traverse a complete natural Tab cycle, including wrap, with both closed.
        // Closed rows may stay in the DOM but must never receive focus.
        await tabTo(summary(0));
        let wrapped = false;
        for (let n = 0; n < 120; n++) {
          await page.keyboard.press('Tab');
          expect(
            await overview.evaluate((el) => {
              const active = document.activeElement;
              return [...el.querySelectorAll('li')].some((row) =>
                row.contains(active),
              );
            }),
            'Collapsed restaurant rows are absent from Tab order',
          ).toBe(false);
          if (
            await summary(0).evaluate((el) => el === document.activeElement)
          ) {
            wrapped = true;
            break;
          }
        }
        expect(wrapped, 'Completed a natural Tab cycle').toBe(true);
      }
      await page.clock.install({ time: new Date('2026-10-25T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-25T12:00:00Z'));
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const initial = await exported();
      await ui(button('Kitchen'));
      // Genuine baseline RED before copy, geometry or imported-fixture assumptions.
      await expect(
        details(0),
        'Maple Street exposes one native details disclosure',
      ).toHaveCount(1);
      for (const i of [0, 1]) {
        await expect(details(i)).toHaveCount(1);
        await expect(summary(i)).toHaveCount(1);
        await state(i, true);
        await expect(region(i).getByRole('listitem')).toHaveCount(
          streets[i][1].length,
        );
      }
      await toggle(0, false);
      await state(1, true);
      await toggle(1, false);
      await state(0, false);
      await hiddenTabOrder();
      await summaries(initial);
      await ui(
        overview.getByRole('link', { name: 'View Riverside unlock goal' }),
      );
      await expect(page.locator('#riverside-title')).toBeFocused();
      await expect(button('Unlock Riverside Market')).toBeDisabled();
      await ui(filter);
      await expect(filter).toBeChecked();
      for (const i of [0, 1]) await state(i, false);
      await summaries(initial);
      expect(await exported()).toEqual(initial);

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
      for (const i of [0, 1]) await state(i, false);
      await expect(filter).toBeChecked();
      await summaries(partial);
      await toggle(1, true, 'Enter');
      await state(0, false);
      await restore(partial);
      await state(0, false);
      await state(1, true);
      await expect(region(1).getByRole('listitem')).toHaveCount(1);
      await expect(region(1).getByRole('listitem')).toContainText(
        'Market Gelato',
      );
      await expect(region(1).getByRole('listitem')).toContainText('Not owned');
      await toggle(1, false);
      // Level changes through supported Restore update whole-catalog summaries
      // without replacing native nodes or reopening either disclosure.
      const advanced = structuredClone(partial);
      advanced.restaurants.sushi_station.level = 100;
      await restore(advanced);
      for (const i of [0, 1]) await state(i, false);
      await summaries(advanced);
      await ui(filter);
      await expect(filter).not.toBeChecked();
      for (const i of [0, 1]) await state(i, false);
      await summaries(advanced);
      await ui(filter);
      const complete = structuredClone(advanced);
      for (const id of streets[0][1]) complete.restaurants[id].level = 100;
      await restore(complete);
      for (const i of [0, 1]) await state(i, false);
      await summaries(complete);
      await toggle(0, true, 'Enter');
      await expect(
        region(0).getByText('All restaurants mastered.', { exact: true }),
      ).toBeVisible();
      await expect(region(0).getByRole('listitem')).toHaveCount(0);
      await state(1, false);
      await toggle(1, true);
      await expect(region(1).getByRole('listitem')).toHaveCount(1);
      await toggle(0, false);
      await toggle(1, false);
      const allComplete = structuredClone(complete);
      Object.values(allComplete.restaurants).forEach((r) =>
        Object.assign(r, { owned: true, level: 100 }),
      );
      await restore(allComplete);
      for (const i of [0, 1]) {
        await state(i, false);
        await toggle(i, true);
        await expect(
          region(i).getByText('All restaurants mastered.', { exact: true }),
        ).toBeVisible();
        await toggle(i, false);
      }
      await summaries(allComplete);
      await restore(advanced);
      for (const [i, name, streetId, sign] of [
        [1, 'Market Gelato', 'riverside_market', 'RIVERSIDE MARKET'],
        [0, 'Coffee Corner', 'maple_street', 'MAPLE STREET'],
      ]) {
        // First visit follows Restore while closed; next follows Kitchen remount.
        if (await details(i).evaluate((el) => el.open)) await toggle(i, false);
        await toggle(i, true);
        const visit = region(i).getByRole('button', {
          name: `Visit ${name}`,
          exact: true,
        });
        await layout(visit);
        await ui(visit);
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
        for (const j of [0, 1]) await state(j, true);
        await expect(filter).not.toBeChecked();
      }
      for (const i of [0, 1]) await toggle(i, false);
      expect(await exported()).toEqual(advanced);
      await page.reload();
      await frames();
      expect(await exported()).toEqual(advanced);
      await ui(button('Kitchen'));
      for (const i of [0, 1]) {
        await state(i, true);
        await expect(region(i).getByRole('listitem')).toHaveCount(
          streets[i][1].length,
        );
      }
      await summaries(advanced);
      await summary(0).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/mastery-disclosure-${width}x${height}-imported-Canvas-fixture.png`,
      });
      expect(errors).toEqual([]);
      console.log(
        `PASS mastery disclosure ${width}x${height}: native default open, independent state, keyboard/coordinate touch/44px hit tests, hidden Tab order, locked goal, mounted Restore/level/filter retention, whole-catalog summaries/empty states, visits, exact exports/reload, no errors/overflow; imported Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
