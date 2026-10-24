import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to public production or a stable preview');
// Supported imported Canvas fixtures, not naturally earned WebGL progress.
// Date stays fixed while Phaser frames advance. QA hooks are read-only.
// Opacity is a separate usability requirement. Never infer contrast through
// translucent labels from an opaque DOM ancestor behind the canvas terrain.
const failures = [];
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const mobile of [false, true]) {
    const mode = mobile ? 'touch390x844' : 'desktop1440x900';
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
      const cdp = await context.newCDPSession(page);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const button = (name) => page.getByRole('button', { name, exact: true });
      const frames = () => page.clock.runFor(1000);
      const ui = (target) => (mobile ? target.tap() : target.click());
      async function geometry(target) {
        return target.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            visible:
              r.width > 0 &&
              r.height > 0 &&
              r.left >= 0 &&
              r.right <= innerWidth &&
              r.top >= 0 &&
              r.bottom <= innerHeight &&
              [0.2, 0.5, 0.8].every((x) =>
                [0.2, 0.5, 0.8].every((y) =>
                  el.contains(
                    document.elementFromPoint(
                      r.x + x * r.width,
                      r.y + y * r.height,
                    ),
                  ),
                ),
              ),
          };
        });
      }
      async function coordinate(target) {
        const r = await geometry(target);
        expect(
          r.visible,
          'Real coordinate target is contained and unobstructed',
        ).toBe(true);
        if (mobile)
          await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
        else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
        await frames();
      }
      async function exported() {
        await ui(button('Settings'));
        await ui(button('Copy / download save'));
        await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
          'Save copied to clipboard.',
        );
        const result = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        await ui(button('Back to the neighborhood'));
        return result;
      }
      async function reveal(target) {
        // Bounded real map drags, including when the selected panel covers a
        // label. No DOM scrolling/repositioning, forced clicks or writable hooks.
        for (let attempt = 0; attempt < 12; attempt++) {
          if ((await geometry(target)).visible) return;
          const area = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            const r = canvas.getBoundingClientRect();
            const heading = document
              .querySelector('.street-heading')
              .getBoundingClientRect();
            const panel = document
              .querySelector('.restaurant-panel')
              ?.getBoundingClientRect();
            const left = Math.max(10, r.left + 10),
              top = Math.max(r.top + 10, heading.bottom + 15);
            let right = Math.min(innerWidth - 65, r.right - 10),
              bottom = Math.min(innerHeight - 100, r.bottom - 80);
            if (panel) {
              if (panel.width > innerWidth * 0.8)
                bottom = Math.min(bottom, panel.top - 10);
              else right = Math.min(right, panel.left - 15);
            }
            const x = (left + right) / 2,
              y = (top + bottom) / 2;
            const starts = [];
            for (let sy = top + 10; sy < bottom - 10; sy += 20)
              for (let sx = left + 10; sx < right - 10; sx += 20)
                if (document.elementFromPoint(sx, sy) === canvas)
                  starts.push({ x: sx, y: sy });
            return { left, right, top, bottom, x, y, starts };
          });
          expect(
            area.starts.length,
            'Exposed canvas for native pan',
          ).toBeGreaterThan(0);
          const r = await geometry(target);
          const dx = Math.max(-90, Math.min(90, area.x - r.x - r.width / 2));
          const dy = Math.max(-90, Math.min(90, area.y - r.y - r.height / 2));
          const start = area.starts.find(
            (p) =>
              p.x + dx > area.left &&
              p.x + dx < area.right &&
              p.y + dy > area.top &&
              p.y + dy < area.bottom,
          );
          expect(start, 'Pan fits exposed map area').toBeTruthy();
          if (mobile) {
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchStart',
              touchPoints: [start],
            });
            for (let i = 1; i <= 6; i++) {
              await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [
                  { x: start.x + (dx * i) / 6, y: start.y + (dy * i) / 6 },
                ],
              });
              await page.clock.runFor(32);
            }
            await cdp.send('Input.dispatchTouchEvent', {
              type: 'touchEnd',
              touchPoints: [],
            });
          } else {
            await page.mouse.move(start.x, start.y);
            await page.mouse.down();
            await page.mouse.move(start.x + dx, start.y + dy, { steps: 6 });
            await page.mouse.up();
          }
          await frames();
        }
        expect(
          (await geometry(target)).visible,
          'Label reachable by bounded real pan',
        ).toBe(true);
      }
      async function measure(target, label) {
        const result = await target.evaluate((el) => {
          const parse = (s) => {
            const m = s.match(/^rgba?\(([^)]+)\)$/);
            if (!m) throw new Error(`Unsupported color ${s}`);
            const c = m[1].split(',').map(Number);
            if (c.length === 3) c.push(1);
            if (c.length !== 4 || c.some((v) => !Number.isFinite(v)))
              throw new Error('Unsupported color');
            return c;
          };
          const backing = el.closest('.building-label');
          for (let n = el; n; n = n.parentElement) {
            const s = getComputedStyle(n);
            if (
              Number(s.opacity) !== 1 ||
              s.filter !== 'none' ||
              s.mixBlendMode !== 'normal' ||
              s.maskImage !== 'none' ||
              s.backdropFilter !== 'none'
            )
              throw new Error('Unsupported compositing; not contrast RED');
            if (s.backgroundImage !== 'none')
              throw new Error('Unsupported background image');
            for (const pseudo of ['::before', '::after'])
              if (
                !['none', 'normal'].includes(
                  getComputedStyle(n, pseudo).content,
                )
              )
                throw new Error('Unsupported generated paint');
          }
          const s = getComputedStyle(el),
            bg = parse(getComputedStyle(backing).backgroundColor),
            fg = parse(s.color);
          if (
            fg[3] !== 1 ||
            s.textShadow !== 'none' ||
            s.webkitTextFillColor !== s.color ||
            parseFloat(s.webkitTextStrokeWidth) !== 0
          )
            throw new Error('Unsupported foreground');
          if (el !== backing && parse(s.backgroundColor)[3] !== 0)
            throw new Error('Unexpected child background');
          if (el.closest('[inert],:disabled,[aria-disabled="true"]'))
            throw new Error('Inactive sample');
          const nodes = [...el.childNodes].filter(
            (n) =>
              n.nodeType === Node.TEXT_NODE &&
              /[\p{L}\p{N}]/u.test(n.textContent),
          );
          if (!nodes.length)
            throw new Error('Missing direct title/level/price text');
          for (const node of nodes) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rects = [...range.getClientRects()];
            if (
              !rects.length ||
              !rects.every(
                (r) =>
                  r.width > 0 &&
                  r.height > 0 &&
                  r.left >= 0 &&
                  r.right <= innerWidth &&
                  r.top >= 0 &&
                  r.bottom <= innerHeight &&
                  [0.15, 0.5, 0.85].every((x) =>
                    el.contains(
                      document.elementFromPoint(
                        r.left + x * r.width,
                        r.top + r.height / 2,
                      ),
                    ),
                  ),
              )
            )
              throw new Error('Text range clipped or occluded');
          }
          const lum = (c) =>
            c
              .slice(0, 3)
              .map((v) => {
                v /= 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          // Alpha failure is genuine opacity RED, with NO hypothetical ratio.
          const a = lum(fg),
            b = lum(bg);
          return {
            bg,
            fg,
            ratio:
              bg[3] === 1
                ? (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
                : null,
          };
        });
        const key = `${mode} ${label}`;
        console.log(key, JSON.stringify(result));
        if (result.bg[3] !== 1)
          failures.push(
            `${key}: OPACITY RED alpha=${result.bg[3]}, required 1; contrast unmeasured`,
          );
        expect(result.bg.slice(0, 3), `${key}: cream background`).toEqual([
          255, 252, 242,
        ]);
        if (result.ratio !== null && result.ratio < 4.5)
          failures.push(`${key}: CONTRAST RED ${result.ratio} < 4.5`);
      }
      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const fixture = await exported();
      fixture.pendingOffline = 0;
      // Maple starts with one owned and one for-sale representative.
      // Riverside requires a distinct valid advanced fixture: every Maple
      // restaurant must be level 25 before its unlocked metadata is accepted.
      async function restore() {
        await ui(button('Settings'));
        await page
          .getByLabel('Import a saved street')
          .fill(JSON.stringify(fixture));
        await ui(button('Restore save'));
        await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
          'Street restored.',
        );
        await ui(button('Back to the neighborhood'));
        expect(await exported()).toEqual(fixture);
      }
      await restore();
      for (const [street, name, samples] of [
        [
          'maple_street',
          'Maple Street',
          [
            ['noodle_nook', 'Noodle Nook', true],
            ['coffee_corner', 'Coffee Corner', false],
          ],
        ],
        [
          'riverside_market',
          'Riverside Market',
          [
            ['river_grill', 'River Grill', true],
            ['market_gelato', 'Market Gelato', false],
          ],
        ],
      ]) {
        if (street === 'riverside_market') {
          for (const [id, restaurant] of Object.entries(fixture.restaurants)) {
            if (!['river_grill', 'market_gelato'].includes(id))
              Object.assign(restaurant, {
                owned: true,
                level: 25,
                register: 0,
                hasManager: false,
              });
          }
          fixture.neighborhood.unlockedStreets.push('riverside_market');
          Object.assign(fixture.restaurants.river_grill, {
            owned: true,
            level: 1,
            register: 0,
            hasManager: false,
          });
          await restore();
        }
        await coordinate(button(name));
        await frames();
        await expect(button(name)).toHaveAttribute('aria-pressed', 'true');
        fixture.neighborhood.currentStreet = street;
        expect(await exported()).toEqual(fixture);
        expect(
          await page.evaluate(() => window.restaurantQA().scene.ready),
        ).toBe(true);
        await coordinate(button('Zoom out'));
        for (const [id, title, owned] of samples) {
          const target = page.locator(`#restaurant-plot-${id}`);
          await expect(target).toContainText(owned ? title : 'For Sale');
          await expect(target.locator('small')).toContainText(
            owned ? 'Lv 1' : '🪙',
          );
          for (const selected of [false, true]) {
            if (selected) {
              await coordinate(target);
              await expect(page.locator('.restaurant-panel h2')).toContainText(
                title,
              );
              await expect(page.locator('.restaurant-panel h2')).toBeFocused();
              await expect(target.locator('..')).toHaveClass(/selected/);
              if (mobile) {
                // The full-width touch detail sheet covers the map. Verify
                // selection/focus, but never call hidden text a visible sample.
                // Selected paint is sampled on desktop; touch normal paint is
                // sampled before selection and again after real dismissal.
                await page.screenshot({
                  path: `test-results/map-labels-${mode}-${street}-${id}-selected-sheet-imported-Canvas-fixture.png`,
                });
                continue;
              }
            }
            await reveal(target);
            const label = `${street}-${id}-${selected ? 'selected' : 'normal'}`;
            await page.screenshot({
              path: `test-results/map-labels-${mode}-${label}-imported-Canvas-fixture.png`,
            });
            await measure(target, `${label} direct title`);
            await measure(
              target.locator('small'),
              `${label} ${owned ? 'level' : 'price'}`,
            );
          }
          await coordinate(button('Close restaurant'));
          await expect(page.locator('.restaurant-panel')).toHaveCount(0);
          await expect(target).toBeFocused();
          await expect(target.locator('..')).not.toHaveClass(/selected/);
          await reveal(target);
          await measure(target, `${street}-${id} dismissed direct title`);
          await measure(
            target.locator('small'),
            `${street}-${id} dismissed level/price`,
          );

          expect(await exported()).toEqual(fixture);
        }
        await page.reload();
        await frames();
        expect(await exported()).toEqual(fixture);
        await expect(button(name)).toHaveAttribute('aria-pressed', 'true');
      }
      expect(errors, `${mode} page errors`).toEqual([]);
      console.log(
        `PASS ${mode}: label navigation/selection/dismissal, full saves and reload; imported Canvas fixture, not natural WebGL`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
expect(
  failures,
  'Opaque cream labels and measured normal title/level/price contrast >=4.5:1',
).toEqual([]);
console.log(
  'PASS bounded map-label readability coverage; no general WCAG claim',
);
