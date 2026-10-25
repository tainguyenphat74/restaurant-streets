import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported imported Canvas fixtures, not natural progression, physical-device
// or screen-reader evidence. No store mutation or simulated checkbox events.
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
const mapleNames = [
  'Noodle Nook',
  'Coffee Corner',
  'Sunny Bakery',
  'Taco Tuesday',
  'Tomato & Basil',
  'Sushi Station',
];
const riverNames = ['River Grill', 'Market Gelato'];
const mapleIds = [
  'noodle_nook',
  'coffee_corner',
  'sunny_bakery',
  'taco_tuesday',
  'tomato_basil',
  'sushi_station',
];
try {
  for (const [mobile, width, height] of [
    [false, 1440, 900],
    [true, 390, 844],
    [true, 320, 568],
    [true, 667, 320],
  ]) {
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
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const overview = page.getByRole('region', {
        name: 'Kitchen mastery',
        exact: true,
      });
      const street = (name) =>
        overview.getByRole('region', { name: `${name} mastery`, exact: true });
      const checkbox = overview.getByRole('checkbox', {
        name: 'Hide completed restaurants',
        exact: true,
      });
      const row = (name) =>
        overview
          .getByRole('listitem')
          .filter({ has: page.getByText(name, { exact: true }) });
      async function frames() {
        await page.clock.runFor(1000);
        await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      }
      async function kitchen() {
        await ui(button('Kitchen'));
        await expect(overview).toBeVisible();
      }
      async function exported() {
        await ui(button('Settings'));
        await ui(button('Copy / download save'));
        await expect(
          page
            .getByRole('status')
            .filter({ hasText: 'Save copied to clipboard.' }),
        ).toBeVisible();
        const value = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        await ui(button('Back to the neighborhood'));
        return value;
      }
      async function restore(value) {
        await ui(button('Settings'));
        await page
          .getByLabel('Import a saved street')
          .fill(JSON.stringify(value));
        await ui(button('Restore save'));
        await expect(
          page.getByText('Street restored.', { exact: true }),
        ).toBeVisible();
        await ui(button('Back to the neighborhood'));
        await frames();
        expect(await exported()).toEqual(value);
        // Explicit tab unmount ensures a fresh local checkbox default.
        await ui(button('Street'));
        await frames();
        await kitchen();
        await expect(checkbox).not.toBeChecked();
      }
      async function rows(maple, river) {
        await expect(street('Maple Street').getByRole('listitem')).toHaveCount(
          maple.length,
        );
        await expect(
          street('Riverside Market').getByRole('listitem'),
        ).toHaveCount(river.length);
        for (const name of [...mapleNames, ...riverNames]) {
          await expect(row(name)).toHaveCount(
            [...maple, ...river].includes(name) ? 1 : 0,
          );
        }
        for (const [name, remaining] of [
          ['Maple Street', maple],
          ['Riverside Market', river],
        ]) {
          await expect(
            street(name).getByText('All restaurants mastered.', {
              exact: true,
            }),
          ).toHaveCount(remaining.length === 0 ? 1 : 0);
        }
      }
      async function summaries(
        mapleBadges,
        mapleComplete,
        riverBadges,
        riverComplete,
      ) {
        for (const [name, badges, complete, total] of [
          ['Maple Street', mapleBadges, mapleComplete, 6],
          ['Riverside Market', riverBadges, riverComplete, 2],
        ]) {
          await expect(street(name)).toContainText(
            `${badges} / ${total * 3} badges earned`,
          );
          await expect(street(name)).toContainText(
            `${complete} / ${total} restaurants complete`,
          );
        }
      }
      async function geometry() {
        // Native checkbox may be small; its associated clickable label must
        // provide the full touch target. Accept wrapped or explicit labels.
        const handle = await checkbox.evaluateHandle((el) => {
          const label = [...(el.labels || [])].find((item) =>
            item.textContent.includes('Hide completed restaurants'),
          );
          return label || el;
        });
        const target = handle.asElement();
        try {
          await target.scrollIntoViewIfNeeded();
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
              ].every(([x, y]) => {
                const hit = document.elementFromPoint(
                  r.x + r.width * x,
                  r.y + r.height * y,
                );
                return el.contains(hit);
              });
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
        } finally {
          await handle.dispose();
        }
      }
      async function toggle(checked) {
        await expect(checkbox).toBeEnabled();
        const rect = await geometry();
        if (mobile) {
          // Real coordinate touch at label edge exercises the large target,
          // rather than tapping only the small native checkbox glyph.
          await page.touchscreen.tap(
            rect.x + rect.width * 0.9,
            rect.y + rect.height * 0.5,
          );
        } else {
          for (let i = 0; i < 80; i++) {
            if (await checkbox.evaluate((el) => el === document.activeElement))
              break;
            await page.keyboard.press('Tab');
          }
          await expect(checkbox).toBeFocused();
          await page.keyboard.press('Space');
        }
        await expect(checkbox).toBeChecked({ checked });
      }
      async function visit(name, streetName, expected) {
        // Caller leaves filter active: the Visit must act on a remaining row.
        await expect(checkbox).toBeChecked();
        await ui(
          row(name).getByRole('button', { name: `Visit ${name}`, exact: true }),
        );
        await frames();
        await expect(overview).toHaveCount(0);
        await expect(page.locator('.street-sign')).toContainText(streetName);
        await expect(
          page.getByRole('complementary', { name, exact: true }),
        ).toBeVisible();
        await ui(button('Close restaurant'));
        expect(await exported()).toEqual(expected);
        await kitchen();
        await expect(checkbox).not.toBeChecked();
        await rows(mapleNames, riverNames);
      }
      await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-19T12:00:00Z'));
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const initial = await exported();
      await kitchen();
      // First behavioral RED: assert the actual accessible checkbox before
      // any fixture-dependent expectations or geometry assumptions.
      await expect(
        checkbox,
        'Kitchen mastery exposes Hide completed restaurants',
      ).toHaveCount(1);
      await expect(checkbox).toHaveAttribute('type', 'checkbox');
      await expect(checkbox).not.toBeChecked();
      await rows(mapleNames, riverNames);
      await summaries(0, 0, 0, 0);
      await toggle(true);
      await rows(mapleNames, riverNames);
      await summaries(0, 0, 0, 0);
      await expect(row('Coffee Corner')).toContainText('Not owned');
      await expect(street('Riverside Market')).toContainText('Locked');
      await expect(row('River Grill').getByRole('button')).toHaveCount(0);
      await expect(row('Market Gelato').getByRole('button')).toHaveCount(0);
      // Existing locked goal navigation stays available while filtered.
      await ui(
        overview.getByRole('link', { name: 'View Riverside unlock goal' }),
      );
      await expect(page.locator('#riverside-title')).toBeFocused();
      await expect(button('Unlock Riverside Market')).toBeDisabled();
      expect(await exported()).toEqual(initial);

      const locked = structuredClone(initial);
      Object.assign(locked, {
        coins: 123456.25,
        gems: 42,
        upgrades: ['ingredients'],
      });
      [100, 50, 101, 24, 0, 99].forEach((level, i) =>
        Object.assign(locked.restaurants[mapleIds[i]], {
          owned: level > 0,
          level,
        }),
      );
      await restore(locked);
      await rows(mapleNames, riverNames);
      await summaries(10, 2, 0, 0);
      await toggle(true);
      const lockedRemaining = [
        'Coffee Corner',
        'Taco Tuesday',
        'Tomato & Basil',
        'Sushi Station',
      ];
      await rows(lockedRemaining, riverNames);
      await summaries(10, 2, 0, 0);
      await expect(row('Tomato & Basil')).toContainText('Not owned');
      await expect(street('Riverside Market')).toContainText('Locked');
      await expect(row('River Grill').getByRole('button')).toHaveCount(0);
      await toggle(false);
      await rows(mapleNames, riverNames);
      expect(await exported()).toEqual(locked);

      const partial = structuredClone(locked);
      [100, 50, 101, 25, 25, 99].forEach((level, i) =>
        Object.assign(partial.restaurants[mapleIds[i]], { owned: true, level }),
      );
      partial.neighborhood.unlockedStreets.push('riverside_market');
      Object.assign(partial.restaurants.river_grill, {
        owned: true,
        level: 100,
        register: 123.125,
      });
      await restore(partial);
      await rows(mapleNames, riverNames);
      await summaries(12, 2, 3, 1);
      await toggle(true);
      await rows(lockedRemaining, ['Market Gelato']);
      await summaries(12, 2, 3, 1);
      await expect(row('Market Gelato')).toContainText('Not owned');
      const onRiver = structuredClone(partial);
      onRiver.neighborhood.currentStreet = 'riverside_market';
      await visit('Market Gelato', 'RIVERSIDE MARKET', onRiver);
      await toggle(true);
      await rows(lockedRemaining, ['Market Gelato']);
      await visit('Coffee Corner', 'MAPLE STREET', partial);
      await toggle(true);
      await rows(lockedRemaining, ['Market Gelato']);
      expect(await exported()).toEqual(partial);
      await page.reload();
      await frames();
      expect(await exported()).toEqual(partial);
      await kitchen();
      await expect(checkbox).not.toBeChecked();
      await rows(mapleNames, riverNames);
      await summaries(12, 2, 3, 1);

      // One empty street must not suppress the other street's unfinished rows.
      const mapleComplete = structuredClone(partial);
      mapleIds.forEach((id) => {
        mapleComplete.restaurants[id].level = 100;
      });
      await restore(mapleComplete);
      await toggle(true);
      await rows([], ['Market Gelato']);
      await summaries(18, 6, 3, 1);
      expect(await exported()).toEqual(mapleComplete);
      await toggle(false);
      await rows(mapleNames, riverNames);

      const complete = structuredClone(partial);
      Object.values(complete.restaurants).forEach((r, i) =>
        Object.assign(r, { owned: true, level: i % 2 ? 1000 : 100 }),
      );
      await restore(complete);
      await rows(mapleNames, riverNames);
      await summaries(18, 6, 6, 2);
      await toggle(true);
      await rows([], []);
      await summaries(18, 6, 6, 2);
      await geometry();
      expect(await exported()).toEqual(complete);
      await toggle(false);
      await rows(mapleNames, riverNames);
      await summaries(18, 6, 6, 2);
      await toggle(true);
      await rows([], []);
      expect(await exported()).toEqual(complete);
      await page.reload();
      await frames();
      expect(await exported()).toEqual(complete);
      await kitchen();
      await expect(checkbox).not.toBeChecked();
      await rows(mapleNames, riverNames);
      await geometry();
      expect(errors).toEqual([]);
      console.log(
        `PASS mastery filter ${width}x${height}: default eight rows, both-street filtering/summaries, locked/unowned, keyboard Space or coordinate touch/44px hit tests, visits/remount, empty/restore, exact exports/reload, no overflow/page errors; imported Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
