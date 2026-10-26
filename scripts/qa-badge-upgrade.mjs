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
const format = (n) => {
  for (const [size, suffix] of [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]) {
    if (n >= size) return (n / size).toFixed(1).replace(/\.0$/, '') + suffix;
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
};
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
      const badge = button('Next badge');
      const upgrade = page.getByRole('button', { name: /Upgrade restaurant/ });
      async function frames() {
        await page.clock.runFor(1000);
        await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      }
      async function closePanel() {
        if (await button('Close restaurant').count())
          await ui(button('Close restaurant'));
      }
      async function exported() {
        await closePanel();
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
        await closePanel();
        await ui(button('Settings'));
        await page
          .getByLabel('Import a saved street')
          .fill(JSON.stringify(save));
        await ui(button('Restore save'));
        await expect(
          page.getByText('Street restored.', { exact: true }),
        ).toBeVisible();
        await ui(button('Back to the neighborhood'));
        expect(await exported()).toEqual(save);
      }
      async function open(name) {
        await ui(button('Kitchen'));
        // Kitchen exposes native Visit controls even while scene frames are paused.
        await ui(
          page
            .locator('.card-grid .card')
            .filter({ has: page.getByRole('heading', { name, exact: true }) })
            .getByRole('button', { name: 'Visit restaurant ↗', exact: true }),
        );
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
          await page
            .locator('.restaurant-panel')
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
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

      async function activate(target, key = 'Enter') {
        const rect = await layout(target);
        if (mobile)
          await page.touchscreen.tap(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
        else {
          await tabTo(target);
          expect(
            await target.evaluate((el) => el.matches(':focus-visible')),
          ).toBe(true);
          await page.keyboard.press(key);
        }
      }
      await page.clock.install({ time: new Date('2026-10-26T06:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-26T06:00:00Z'));
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const initial = await exported();
      expect(initial.version).toBe(4);
      const fixture = (id, level, coins) => {
        const save = structuredClone(initial);
        if (id === 'river_grill') {
          ids.forEach((id) =>
            Object.assign(save.restaurants[id], {
              owned: true,
              level: 25,
              register: 19,
              hasManager: true,
            }),
          );
          save.neighborhood = {
            currentStreet: 'riverside_market',
            unlockedStreets: ['maple_street', 'riverside_market'],
          };
        }
        Object.assign(save.restaurants[id], {
          owned: true,
          level,
          register: 17,
          hasManager: true,
        });
        Object.assign(save, {
          coins,
          gems: 13,
          upgrades: ['ingredients'],
          boostUntil: save.savedAt + 600000,
        });
        return save;
      };
      let save = fixture('noodle_nook', 9, 1e14);
      await restore(save);
      await open('Noodle Nook');
      console.log(
        `READY badge ${width}x${height}: successful boot and exact supported v4 import/export`,
      );
      await expect(badge, 'Native Next badge button').toHaveCount(1);
      await expect(badge).toHaveJSProperty('tagName', 'BUTTON');
      await expect(button('Buy 1')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.badge-target')).toHaveCount(0);
      async function purchase(id, name, before, target) {
        await open(name);
        await activate(badge, 'Space');
        await expect(badge).toHaveAttribute('aria-pressed', 'true');
        const nextName =
          target === 25 ? 'Apprentice' : target === 50 ? 'Artisan' : 'Master';
        await expect(page.locator('.badge-target')).toContainText(
          `${nextName} at level ${target}`,
        );
        const expected = structuredClone(before);
        const r = expected.restaurants[id];
        const baseCost = id === 'river_grill' ? 12000000 : 10;
        let count = 0;
        let totalCost = 0;
        const initialGems = expected.gems;
        while (r.level < target) {
          const cost = baseCost * 1.15 ** r.level;
          if (expected.coins < cost) break;
          expected.coins -= cost;
          totalCost += cost;
          r.level++;
          count++;
          if ([10, 25, 50, 100].includes(r.level)) expected.gems += 5;
        }
        await expect(page.locator('.bulk-quote')).toContainText(
          `${count} level`,
        );
        await expect(page.locator('.bulk-quote')).toContainText(
          `🪙 ${format(totalCost)}`,
        );
        if (expected.gems > initialGems)
          await expect(page.locator('.bulk-quote')).toContainText(
            `+${expected.gems - initialGems} gems`,
          );
        else
          await expect(page.locator('.bulk-quote')).not.toContainText('gems');
        if (r.level < target)
          await expect(page.locator('.badge-target')).toContainText(
            'Partial purchase',
          );
        if (count) await activate(upgrade);
        else await expect(upgrade).toBeDisabled();
        if (r.level < target) await expect(upgrade).toBeDisabled();
        if (r.level === target && target < 100) {
          await expect(page.locator('.badge-target')).toContainText(
            target === 25 ? 'Artisan at level 50' : 'Master at level 100',
          );
          await expect(badge).toHaveAttribute('aria-pressed', 'true');
        }
        if (r.level === 100) {
          await expect(badge).toBeDisabled();
          await expect(upgrade).toBeDisabled();
          await expect(page.locator('.bulk-quote')).toContainText('0 levels');
          await expect(page.locator('.bulk-quote')).not.toContainText(
            'Insufficient',
          );
          await expect(button('Buy 1')).toBeEnabled();
          await activate(button('Buy 1'));
          await expect(upgrade).toBeEnabled();
          await activate(upgrade);
          expected.coins -= baseCost * 1.15 ** 100;
          expected.restaurants[id].level = 101;
        }
        await layout(button('Buy 1'));
        await page.screenshot({
          path: `test-results/badge-imported-fixture-${width}-${id}-${target}-${before.coins}.png`,
        });
        expect(await exported()).toEqual(expected);
        return expected;
      }
      await closePanel();
      for (const [id, name] of [
        ['noodle_nook', 'Noodle Nook'],
        ['river_grill', 'River Grill'],
      ]) {
        save = fixture(id, 9, 1e17);
        await restore(save);
        for (const target of [25, 50, 100])
          save = await purchase(id, name, save, target);
        // Reload boots Street and accrues a zero-time tick. Existing managers
        // legitimately sweep retained registers even with wall time frozen;
        // purchase equality above proves the upgrade itself preserved them.
        const afterReload = structuredClone(save);
        for (const restaurant of Object.values(afterReload.restaurants)) {
          if (restaurant.owned && restaurant.hasManager) {
            afterReload.coins += restaurant.register;
            restaurant.register = 0;
          }
        }
        await page.reload();
        await frames();
        expect(await exported()).toEqual(afterReload);
        for (const coins of [
          0,
          (id === 'river_grill' ? 12000000 : 10) * 1.15 ** 9 * 2.2,
        ]) {
          save = fixture(id, 9, coins);
          await restore(save);
          await purchase(id, name, save, 25);
        }
      }
      save = fixture('noodle_nook', 1000, 1e90);
      await restore(save);
      await open('Noodle Nook');
      await expect(badge).toBeDisabled();
      await expect(upgrade).toBeDisabled();
      expect(await exported()).toEqual(save);
      // Locked Riverside remains inspectable in Kitchen but cannot be visited.
      const locked = page.getByRole('region', {
        name: 'Riverside Market mastery',
        exact: true,
      });
      const disclosure = locked.locator('summary');
      if (!(await locked.locator('details').evaluate((el) => el.open)))
        await ui(disclosure);
      await expect(
        locked.getByRole('button', { name: 'Visit River Grill', exact: true }),
      ).toHaveCount(0);
      await expect(locked).toContainText('Locked');
      expect(await exported()).toEqual(save);
      expect(errors).toEqual([]);
      console.log(
        `PASS badge ${width}x${height}: native keyboard/touch, 44px hit tests, partial/zero, 25→50→100, other modes, both streets/reload/exact full saves; imported frozen Canvas`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
