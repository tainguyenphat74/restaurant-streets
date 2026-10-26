import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to stable production preview or live URL');
// Supported imported Canvas fixtures with frozen time, not fresh real-time
// WebGL gameplay, physical-device or screen-reader acceptance. No store writes,
// injected toggle events, programmatic focus or custom keyboard handling.
const ids = [
  'noodle_nook',
  'coffee_corner',
  'sunny_bakery',
  'taco_tuesday',
  'tomato_basil',
  'sushi_station',
];
const names = [
  'Noodle Nook',
  'Coffee Corner',
  'Sunny Bakery',
  'Taco Tuesday',
  'Tomato & Basil',
  'Sushi Station',
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
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const goal = page.getByRole('region', {
        name: 'Riverside Market',
        exact: true,
      });
      const filter = goal.getByRole('checkbox', {
        name: 'Hide completed unlock goals',
        exact: true,
      });
      const row = (i) =>
        goal.getByRole('listitem').filter({
          has: page.getByRole('button', {
            name: `Visit ${names[i]}`,
            exact: true,
          }),
        });
      const summary = goal.getByRole('progressbar', {
        name: 'Riverside goal completion',
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
        const handle = await goal.elementHandle();
        await ui(button('Settings'));
        await page
          .getByLabel('Import a saved street')
          .fill(JSON.stringify(save));
        await ui(button('Restore save'));
        await expect(
          page.getByText('Street restored.', { exact: true }),
        ).toBeVisible();
        await ui(button('Back to the neighborhood'));
        expect(await goal.evaluate((el, old) => el === old, handle)).toBe(true);
        await handle.dispose();
        expect(await exported()).toEqual(save);
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
          await goal.evaluate((el) => el.scrollWidth <= el.clientWidth),
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

      async function toggle(checked) {
        const rect = await layout(filter.locator('..'));
        if (mobile)
          await page.touchscreen.tap(
            rect.x + rect.width * 0.9,
            rect.y + rect.height / 2,
          );
        else {
          await tabTo(filter);
          expect(
            await filter.evaluate((el) => el.matches(':focus-visible')),
          ).toBe(true);
          await page.keyboard.press('Space');
        }
        await expect(filter).toBeChecked({ checked });
      }
      async function rows(levels, hidden = false) {
        await expect(goal.getByRole('listitem')).toHaveCount(
          levels.filter((l) => !hidden || l < 25).length,
        );
        for (let i = 0; i < 6; i++) {
          if (hidden && levels[i] >= 25) {
            await expect(row(i)).toHaveCount(0);
            continue;
          }
          await expect(row(i)).toContainText(
            levels[i] === 0
              ? 'Not owned · Level 0 / 25'
              : `Level ${levels[i]} / 25`,
          );
          const progress = row(i).getByRole('progressbar', {
            name: `${names[i]} unlock goal progress`,
            exact: true,
          });
          await expect(progress).toHaveJSProperty('tagName', 'PROGRESS');
          await expect(progress).toHaveJSProperty('max', 25);
          await expect(progress).toHaveJSProperty(
            'value',
            Math.min(levels[i], 25),
          );
          await layout(row(i).getByRole('button'));
        }
        const count = levels.filter((l) => l >= 25).length;
        await expect(goal).toContainText(`${count} / 6 restaurants complete`);
        await expect(summary).toHaveJSProperty('value', count);
        await expect(summary).toHaveJSProperty('max', 6);
      }
      await page.clock.install({ time: new Date('2026-10-25T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-25T12:00:00Z'));
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const initial = await exported();
      expect(initial.version).toBe(4);
      await ui(button('Kitchen'));
      const mixed = structuredClone(initial);
      const levels = [25, 1000, 24, 1, 0, 26];
      levels.forEach((level, i) =>
        Object.assign(mixed.restaurants[ids[i]], { owned: level > 0, level }),
      );
      await restore(mixed);
      console.log(
        `READY Riverside goals ${width}x${height}: boot and exact supported v4 import/export succeeded`,
      );
      await expect(
        filter,
        'Native Hide completed unlock goals checkbox',
      ).toHaveCount(1);
      await expect(filter).toHaveAttribute('type', 'checkbox');
      await expect(filter).toHaveJSProperty('tagName', 'INPUT');
      await expect(filter).not.toBeChecked();
      await expect(button('Unlock Riverside Market')).toBeDisabled();
      await rows(levels);
      const survivor = await row(2).elementHandle();
      await toggle(true);
      await rows(levels, true);
      expect(await row(2).evaluate((el, old) => el === old, survivor)).toBe(
        true,
      );
      const advanced = structuredClone(mixed);
      advanced.restaurants.taco_tuesday.level = 25;
      await restore(advanced);
      await expect(filter).toBeChecked();
      await rows([25, 1000, 24, 25, 0, 26], true);
      expect(await row(2).evaluate((el, old) => el === old, survivor)).toBe(
        true,
      );
      await survivor.dispose();
      // Row Visit opens the global detail panel while Kitchen stays selected.
      const visit = row(2).getByRole('button', {
        name: 'Visit Sunny Bakery',
        exact: true,
      });
      await layout(visit);
      if (mobile) await visit.tap();
      else {
        await tabTo(visit);
        await page.keyboard.press('Enter');
      }
      await expect(button('Close restaurant')).toBeVisible();
      await expect(button('Kitchen')).toHaveAttribute('aria-current', 'page');
      await ui(button('Close restaurant'));
      await expect(filter).toBeChecked();
      expect(await exported()).toEqual(advanced);
      const complete = structuredClone(advanced);
      ids.forEach((id) =>
        Object.assign(complete.restaurants[id], { owned: true, level: 25 }),
      );
      await restore(complete);
      await expect(filter).toBeChecked();
      await rows([25, 25, 25, 25, 25, 25], true);
      await expect(goal.getByRole('status')).toHaveText(
        'All unlock goals complete.',
      );
      await expect(button('Unlock Riverside Market')).toBeEnabled();
      await layout(button('Unlock Riverside Market'));
      await toggle(false);
      await rows([25, 25, 25, 25, 25, 25]);
      await expect(goal.getByRole('status')).toHaveCount(0);
      await toggle(true);
      const unlocked = structuredClone(complete);
      unlocked.neighborhood.unlockedStreets.push('riverside_market');
      await restore(unlocked);
      await expect(filter).toBeChecked();
      await expect(button('✓ Riverside unlocked')).toBeDisabled();
      await layout(button('Visit Riverside Market ↗'));
      await expect(goal.getByRole('status')).toHaveText(
        'All unlock goals complete.',
      );
      expect(await exported()).toEqual(unlocked);
      await ui(button('Upgrades'));
      await ui(button('Kitchen'));
      await expect(filter).not.toBeChecked();
      await rows([25, 25, 25, 25, 25, 25]);
      await toggle(true);
      await page.reload();
      // Reload mounts Street; controlled frames only while that scene is mounted.
      await frames();
      expect(await exported()).toEqual(unlocked);
      await ui(button('Kitchen'));
      await expect(filter).not.toBeChecked();
      await rows([25, 25, 25, 25, 25, 25]);
      expect(await exported()).toEqual(unlocked);
      expect(errors).toEqual([]);
      console.log(
        `PASS Riverside goals ${width}x${height}: native keyboard/touch, geometry, clamped progress, mounted Restore/keyed rows, empty/recovery/defaults, exact saves; imported frozen Canvas`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
