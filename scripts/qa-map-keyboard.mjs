import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to public production or a stable preview');
// Supported Canvas fixtures; standard qa.mjs remains separate WebGL coverage.
// Only the existing read-only snapshot observes the camera. All actions are UI.
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const frames = () => page.clock.runFor(1000);
      const camera = () =>
        page.evaluate(() => {
          const { ready, scrollX, scrollY, zoom } = window.restaurantQA().scene;
          if (!ready) throw new Error('Scene not ready');
          return { scrollX, scrollY, zoom };
        });
      async function tabTo(target) {
        await expect(target).toHaveCount(1);
        for (let i = 0; i < 100; i++) {
          if (await target.evaluate((el) => el === document.activeElement))
            return;
          await page.keyboard.press('Tab');
        }
        throw new Error('Natural Tab did not reach requested control');
      }
      async function key(value, count = 1) {
        for (let i = 0; i < count; i++) {
          await page.keyboard.press(value);
          await page.clock.runFor(32);
        }
        await frames();
        return camera();
      }
      async function exported() {
        await ui(button('Settings'));
        await ui(button('Copy / download save'));
        await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
          'Save copied to clipboard.',
        );
        const data = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        await ui(button('Back to the neighborhood'));
        return data;
      }
      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const fixture = await exported();
      Object.assign(fixture, { coins: 12345.25, gems: 37, pendingOffline: 0 });
      for (const [id, restaurant] of Object.entries(fixture.restaurants)) {
        if (!['river_grill', 'market_gelato'].includes(id))
          Object.assign(restaurant, {
            owned: true,
            level: 25,
            register: 12.5,
            hasManager: false,
          });
      }
      fixture.neighborhood.unlockedStreets = [
        'maple_street',
        'riverside_market',
      ];
      await ui(button('Settings'));
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify(fixture));
      await ui(button('Restore save'));
      await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
        'Street restored.',
      );
      await ui(button('Back to the neighborhood'));
      await frames();
      expect(await exported()).toEqual(fixture);
      for (const [street, name] of [
        ['maple_street', 'Maple Street'],
        ['riverside_market', 'Riverside Market'],
      ]) {
        await ui(button(name));
        await frames();
        fixture.neighborhood.currentStreet = street;
        // Named, focusable surface, without application-mode semantics.
        const map = page.getByRole('region', {
          name: `${name} map`,
          exact: true,
        });
        await tabTo(map);
        await expect(map).toBeFocused();
        const description = await map.getAttribute('aria-describedby');
        expect(description).toBeTruthy();
        const instructions = page.locator(`[id="${description}"]`);
        await expect(instructions).toBeVisible();
        await expect(instructions).toContainText(/arrow/i);
        await expect(instructions).toContainText(/zoom/i);
        await expect(instructions).toContainText(/Home/);
        await expect(instructions).toContainText(/Tab/);
        expect(
          await map.evaluate((el) => {
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return (
              el.matches(':focus-visible') &&
              s.outlineStyle !== 'none' &&
              parseFloat(s.outlineWidth) >= 2 &&
              s.outlineColor !== 'transparent' &&
              r.width > 0 &&
              r.height > 0
            );
          }),
          'Visible keyboard focus outline',
        ).toBe(true);
        const home = await key('Home');
        // Compare pixel distances at two zooms away from camera bounds.
        let distance;
        for (const zoomKeys of [6, 9]) {
          await key('Home');
          await key('=', zoomKeys);
          const origin = await camera();
          for (const [arrow, axis, sign] of [
            ['ArrowRight', 'scrollX', 1],
            ['ArrowLeft', 'scrollX', -1],
            ['ArrowDown', 'scrollY', 1],
            ['ArrowUp', 'scrollY', -1],
          ]) {
            const before = await camera();
            const after = await key(arrow);
            const pixels = (after[axis] - before[axis]) * before.zoom * sign;
            expect(pixels, `${arrow} actual camera movement`).toBeGreaterThan(
              0,
            );
            if (distance === undefined) distance = pixels;
            expect(pixels).toBeCloseTo(distance, 4);
            expect(
              after[axis === 'scrollX' ? 'scrollY' : 'scrollX'],
            ).toBeCloseTo(
              before[axis === 'scrollX' ? 'scrollY' : 'scrollX'],
              4,
            );
            expect(after.zoom).toBe(before.zoom);
          }
          expect(await camera()).toEqual(origin);
        }
        await key('Home');
        const plus = await key('+');
        expect(plus.zoom).toBeGreaterThan(home.zoom);
        expect((await key('-')).zoom).toBeCloseTo(home.zoom, 8);
        expect((await key('=', 30)).zoom).toBe(2);
        expect((await key('=', 3)).zoom).toBe(2);
        expect((await key('-', 40)).zoom).toBe(0.5);
        expect((await key('-', 3)).zoom).toBe(0.5);
        await key('=', 30);
        // Each edge must plateau, stay finite, and allow travel back inward.
        for (const [arrow, reverse, axis] of [
          ['ArrowRight', 'ArrowLeft', 'scrollX'],
          ['ArrowLeft', 'ArrowRight', 'scrollX'],
          ['ArrowDown', 'ArrowUp', 'scrollY'],
          ['ArrowUp', 'ArrowDown', 'scrollY'],
        ]) {
          const edge = await key(arrow, 160);
          expect(Number.isFinite(edge[axis])).toBe(true);
          expect(Math.abs(edge[axis])).toBeLessThan(4000);
          expect(await key(arrow, 5)).toEqual(edge);
          expect((await key(reverse))[axis]).not.toBe(edge[axis]);
        }
        expect(await key('Home')).toEqual(home);
        for (const shortcut of [
          'Control+ArrowRight',
          'Alt+ArrowDown',
          'Meta+ArrowLeft',
          'Escape',
        ])
          expect(await key(shortcut)).toEqual(home);
        await page.keyboard.press('Tab');
        await expect(map).not.toBeFocused();
        await tabTo(button('Zoom in'));
        for (const value of [
          'ArrowRight',
          'ArrowLeft',
          'ArrowUp',
          'ArrowDown',
          '+',
          '=',
          '-',
          'Home',
        ])
          expect(await key(value)).toEqual(home);
        await ui(button('Settings'));
        const draft = page.getByLabel('Import a saved street');
        await draft.fill('unfinished draft');
        await tabTo(draft);
        for (const value of [
          'ArrowRight',
          'ArrowLeft',
          'ArrowUp',
          'ArrowDown',
          '+',
          '=',
          '-',
          'Home',
        ])
          expect(await key(value)).toEqual(home);
        await expect(draft).toBeFocused();
        await ui(button('Back to the neighborhood'));
        expect(await exported()).toEqual(fixture);
        await page.reload();
        await frames();
        expect(await exported()).toEqual(fixture);
        await expect(button(name)).toHaveAttribute('aria-pressed', 'true');
        await tabTo(map);
        expect(await key('Home')).toEqual(home);
        // Exercise teardown/remount without accumulating listeners or canvases.
        await ui(button('Kitchen'));
        await ui(button('Street'));
        await frames();
        await expect(page.locator('canvas')).toHaveCount(1);
        await tabTo(map);
        expect(await key('Home')).toEqual(home);
        expect(await exported()).toEqual(fixture);
      }
      expect(errors).toEqual([]);
      console.log(
        `PASS ${mobile ? 'touch/mobile' : 'desktop'} both streets: natural Tab, named/described map, focus, keyboard pan/zoom/bounds/Home, isolation, exact full saves/reload, teardown; imported Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
