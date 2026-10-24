import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.QA_URL;
if (!base)
  throw new Error(
    'Set QA_URL to the existing public production or stable preview',
  );
// Canvas, fixed-Date fixtures only. Natural progress/WebGL is covered separately
// by qa.mjs. No state writes except supported Settings import; QA is read-only.
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const [name, width, height, mobile] of [
    ['mobile-narrow', 320, 568, true],
    ['mobile-portrait', 390, 844, true],
    ['mobile-short-landscape', 667, 320, true],
    ['mobile-landscape', 844, 390, true],
    ['desktop', 1440, 900, false],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const button = (name) => page.getByRole('button', { name, exact: true });
      const dialog = page.getByRole('dialog', {
        name: 'Make yourself at home',
      });
      const cdp = await context.newCDPSession(page);
      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await page.clock.runFor(1000);
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const frames = () => page.clock.runFor(1000);
      const snap = async () => {
        await frames();
        const result = await page.evaluate(() => window.restaurantQA());
        expect(result.scene.ready).toBe(true);
        return result.scene;
      };
      async function geometry(target, minimum = false) {
        const result = await target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            inside:
              r.left >= 0 &&
              r.right <= innerWidth &&
              r.top >= 0 &&
              r.bottom <= innerHeight,
            overflow: el.scrollWidth - el.clientWidth,
            hit: [0.2, 0.5, 0.8].every((x) =>
              [0.2, 0.5, 0.8].every((y) =>
                el.contains(
                  document.elementFromPoint(
                    r.x + r.width * x,
                    r.y + r.height * y,
                  ),
                ),
              ),
            ),
          };
        });
        if (minimum) {
          console.log(
            `${name} ${await target.getAttribute('aria-label')}: ${result.width}x${result.height}`,
          );
          expect(
            result.width,
            `${name}: real target width`,
          ).toBeGreaterThanOrEqual(44);
          expect(
            result.height,
            `${name}: real target height`,
          ).toBeGreaterThanOrEqual(44);
          expect(
            await target.evaluate((el) => getComputedStyle(el).flexShrink),
          ).toBe('0');
        }
        expect(result.inside, `${name}: viewport containment`).toBe(true);
        expect(result.hit, `${name}: 3x3 interior hit tests`).toBe(true);
        expect(
          result.overflow,
          `${name}: internal horizontal overflow`,
        ).toBeLessThanOrEqual(1);
        return result;
      }
      async function coordinate(target) {
        const r = await geometry(target);
        if (mobile)
          await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
        else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      }
      async function tabTo(target) {
        for (let i = 0; i < 100; i++) {
          if (await target.evaluate((el) => el === document.activeElement))
            return;
          await page.keyboard.press('Tab');
        }
        throw new Error(`${name}: natural Tab did not reach target`);
      }
      async function scrollDialog(direction) {
        const b = await dialog.boundingBox();
        const x = b.x + b.width / 2,
          y = b.y + b.height / 2;
        if (mobile) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y }],
          });
          for (let i = 1; i <= 6; i++) {
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [{ x, y: y - direction * i * 12 }],
            });
            await page.waitForTimeout(20);
          }
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: [],
          });
        } else {
          await page.mouse.move(x, y);
          await page.mouse.wheel(0, direction * 90);
        }
        await frames();
        // Controlled animation frames do not settle Chromium's real-time native
        // touch-scroll inertia. A tap during inertia can stop scrolling instead
        // of activating an unobstructed button. Observe actual scroll stability
        // before computing coordinates; never retry the destructive action.
        let previous = await dialog.evaluate((el) => el.scrollTop);
        let stable = 0;
        for (let i = 0; i < 30 && stable < 3; i++) {
          await page.waitForTimeout(80);
          const current = await dialog.evaluate((el) => el.scrollTop);
          stable = Math.abs(current - previous) < 0.1 ? stable + 1 : 0;
          previous = current;
        }
        expect(stable, `${name}: native scroll settled`).toBe(3);
      }
      async function settingsControl(target) {
        // Only native scrolling; no locator click/tap/fill auto-scroll or force.
        for (let i = 0; i < 50; i++) {
          const visible = await target.evaluate((el) => {
            const r = el.getBoundingClientRect(),
              d = el.closest('[role="dialog"]').getBoundingClientRect();
            return (
              r.top >= Math.max(0, d.top) &&
              r.bottom <= Math.min(innerHeight, d.bottom)
            );
          });
          if (visible) {
            await coordinate(target);
            return;
          }
          const direction = await target.evaluate((el) =>
            el.getBoundingClientRect().top <
            el.closest('[role="dialog"]').getBoundingClientRect().top
              ? -1
              : 1,
          );
          await scrollDialog(direction);
        }
        throw new Error('Settings control not reachable by native scrolling');
      }
      async function closeSettings() {
        await settingsControl(button('Back to the neighborhood'));
        if (await dialog.count())
          await page.screenshot({
            path: `test-results/touch-targets-${name}-settings-dismiss-diagnostic.png`,
          });
        await expect(dialog).toHaveCount(0);
        await expect(button('Settings')).toBeFocused();
      }
      async function exported() {
        await coordinate(button('Settings'));
        await settingsControl(button('Copy / download save'));
        await expect(
          page
            .getByRole('status')
            .filter({ hasText: 'Save copied to clipboard.' }),
        ).toBeVisible();
        const save = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        await closeSettings();
        return save;
      }
      const original = await exported();
      const fixture = {
        ...structuredClone(original),
        // Deliberately wide compact currency labels exercise a developed
        // wallet too; these are supported imported values, not earned progress.
        coins: 999900000000.25,
        gems: 999900,
        pendingOffline: 0,
      };
      await coordinate(button('Settings'));
      await settingsControl(page.getByLabel('Import a saved street'));
      await page.keyboard.insertText(JSON.stringify(fixture));
      await settingsControl(button('Restore save'));
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await closeSettings();
      expect(await exported()).toEqual(fixture);
      // Capture before assertions too, so a behavioral RED has a labeled artifact.
      await page.screenshot({
        path: `test-results/touch-targets-${name}-imported-fixture.png`,
      });
      const header = await geometry(page.locator('.topbar'));
      expect(header.height).toBe(width < 768 ? 126 : 94);
      const settings = await geometry(button('Settings'), true);
      expect(settings.y).toBeGreaterThanOrEqual(header.y);
      expect(settings.y + settings.height).toBeLessThanOrEqual(
        header.y + header.height,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
      for (const selector of [
        '.brand',
        '.brand em',
        '.wallet',
        '.currency',
        '.topbar nav',
      ]) {
        for (const target of await page.locator(selector).all())
          await geometry(target);
      }
      expect(
        await page
          .locator('.brand')
          .evaluate((el) => getComputedStyle(el).fontSize),
      ).toBe(width < 768 ? '17px' : width <= 1100 ? '18px' : '23px');
      if (!mobile) {
        await tabTo(button('Settings'));
        await page.keyboard.press('Enter');
      } else await coordinate(button('Settings'));
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(button('Settings')).toBeFocused();
      for (const tab of ['Kitchen', 'Upgrades', 'Rankings', 'Street']) {
        await coordinate(button(tab));
        await expect(button(tab)).toHaveAttribute('aria-current', 'page');
        // Tabs are UI state, not save fields: compare the entire supported export.
        expect(await exported()).toEqual(fixture);
      }
      const initial = await snap();
      for (const name of ['Zoom in', 'Zoom out', 'Recenter map'])
        await geometry(button(name), true);
      async function mapAction(name) {
        if (mobile) await coordinate(button(name));
        else {
          await tabTo(button(name));
          await page.keyboard.press('Enter');
        }
        return snap();
      }
      const zoomed = await mapAction('Zoom in');
      expect(zoomed.zoom).toBeGreaterThan(initial.zoom);
      const out = await mapAction('Zoom out');
      expect(out.zoom).toBeLessThan(zoomed.zoom);
      await mapAction('Zoom in');
      const centered = await mapAction('Recenter map');
      for (const key of ['zoom', 'scrollX', 'scrollY'])
        expect(centered[key]).toBeCloseTo(initial[key], 5);
      // Also exercise coordinate mouse input on desktop controls.
      if (!mobile) {
        await coordinate(button('Zoom in'));
        await frames();
        await coordinate(button('Recenter map'));
        await frames();
      }
      expect(await exported()).toEqual(fixture);
      await page.reload();
      await frames();
      expect(await exported()).toEqual(fixture);
      await snap();
      await page.screenshot({
        path: `test-results/touch-targets-${name}-imported-fixture-reloaded.png`,
      });
      expect(errors).toEqual([]);
      console.log(
        `PASS ${name}: target geometry/hits, header, focus, input, map snapshots, full saves/reload (Canvas fixture; not natural progress)`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
