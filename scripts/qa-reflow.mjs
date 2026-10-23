import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Root font-size 200% is a rem/inherited-text reflow simulation, NOT browser
// zoom or OS text scaling: explicit px text does not grow. No CSS zoom/transform.
// Supported Canvas import fixtures, not natural progression/WebGL evidence.
// Run unchanged qa.mjs separately for fresh WebGL gameplay and map gestures.
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const [name, width, height, mobile, fontSize] of [
    ['narrow-root-200', 320, 640, true, '200%'],
    ['desktop-root-200', 1440, 900, false, '200%'],
    ['landscape-root-200', 844, 390, true, '200%'],
    ['short-landscape-root-200', 667, 320, true, '200%'],
    ['narrow-default', 320, 640, true, '100%'],
    ['desktop-default', 1440, 900, false, '100%'],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Reapply the simulation before application mount on every reload.
    await page.addInitScript((size) => {
      const apply = () => {
        document.documentElement.style.fontSize = size;
      };
      if (document.documentElement) apply();
      else
        new MutationObserver((_, observer) => {
          if (document.documentElement) {
            apply();
            observer.disconnect();
          }
        }).observe(document, { childList: true });
    }, fontSize);
    const button = (name) => page.getByRole('button', { name, exact: true });
    const activate = (target) => (mobile ? target.tap() : target.click());
    const panel = page.getByRole('complementary', {
      name: 'Noodle Nook',
      exact: true,
    });
    const heading = panel.getByRole('heading', { level: 2 });
    const close = button('Close restaurant');
    await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-23T12:00:00Z'));
    await page.goto(`${base}/?qa=1`);
    await page.clock.runFor(1000);
    await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
    const cdp = await context.newCDPSession(page);
    console.log(
      `CASE ${name}: ${width}x${height}, root font-size ${fontSize} simulation (not real browser zoom)`,
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => getComputedStyle(document.documentElement).fontSize,
        ),
      )
      .toBe(fontSize === '200%' ? '32px' : '16px');
    async function contained(target, label) {
      const bounds = await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          horizontalOverflow: el.scrollWidth - el.clientWidth,
          documentOverflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      expect(bounds.left, `${name}: ${label} left edge`).toBeGreaterThanOrEqual(
        -1,
      );
      expect(bounds.right, `${name}: ${label} right edge`).toBeLessThanOrEqual(
        width + 1,
      );
      expect(
        bounds.horizontalOverflow,
        `${name}: ${label} has no clipped horizontal content`,
      ).toBeLessThanOrEqual(1);
      expect(
        bounds.documentOverflow,
        `${name}: no horizontal document overflow`,
      ).toBeLessThanOrEqual(1);
    }
    async function reachablePoint(target) {
      const result = await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          reachable:
            r.left >= 0 &&
            r.right <= innerWidth &&
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            [0.2, 0.5, 0.8].every((x) =>
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
      expect(
        result.reachable,
        `${name}: ${(await target.getAttribute('aria-label')) || (await target.textContent())} fully visible and hit-testable`,
      ).toBe(true);
      return result;
    }
    async function coordinateActivate(target) {
      const p = await reachablePoint(target);
      if (mobile) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
    }
    async function nativeScroll(target, direction = 1) {
      const b = await target.boundingBox();
      const x = b.x + b.width / 2;
      const start =
        direction > 0
          ? Math.min(height - 12, b.y + b.height - 18)
          : Math.max(12, b.y + 100);
      const distance = Math.min(60, b.height - 120) * direction;
      if (mobile) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y: start }],
        });
        for (let i = 1; i <= 8; i++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: start - (distance * i) / 8 }],
          });
          await page.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
      } else {
        await page.mouse.move(x, start);
        await page.mouse.wheel(0, distance);
      }
      await page.waitForTimeout(150);
    }
    async function settings() {
      await coordinateActivate(button('Settings'));
      const dialog = page.getByRole('dialog', {
        name: 'Make yourself at home',
      });
      await contained(dialog, 'Settings dialog');
      const seen = new Set();
      const controls = dialog.locator('button, textarea');
      const count = await controls.count();
      let scrolled = false;
      for (let i = 0; i < 100; i++) {
        const state = await dialog.evaluate((el) => {
          const box = el.getBoundingClientRect();
          return {
            top: el.scrollTop,
            end: el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
            visible: [...el.querySelectorAll('button, textarea')].flatMap(
              (node, index) => {
                const r = node.getBoundingClientRect();
                return r.left >= box.left &&
                  r.right <= box.right &&
                  r.top >= box.top &&
                  r.bottom <= box.bottom &&
                  node.contains(
                    document.elementFromPoint(
                      r.x + r.width / 2,
                      r.y + r.height / 2,
                    ),
                  )
                  ? [index]
                  : [];
              },
            ),
          };
        });
        state.visible.forEach((index) => seen.add(index));
        scrolled ||= state.top > 0;
        if (state.end) break;
        await nativeScroll(dialog);
        if (i === 99)
          throw new Error(
            `${name}: Settings native scrolling never reached bottom`,
          );
      }
      expect(
        seen.size,
        `${name}: every Settings control fully reachable by native scrolling`,
      ).toBe(count);
      if (await dialog.evaluate((el) => el.scrollHeight > el.clientHeight))
        expect(scrolled).toBe(true);
      await contained(dialog, 'Settings after native scroll');
      await coordinateActivate(button('Back to the neighborhood'));
      await expect(dialog).toHaveCount(0);
      await coordinateActivate(button('Settings'));
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(button('Settings')).toBeFocused();
    }
    await settings();
    await contained(page.locator('.topbar'), 'topbar');
    for (const tab of ['Kitchen', 'Upgrades', 'Rankings', 'Street']) {
      await coordinateActivate(button(tab));
      await expect(button(tab)).toHaveAttribute('aria-current', 'page');
    }
    async function exported() {
      await activate(button('Settings'));
      await activate(button('Copy / download save'));
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: 'Save copied to clipboard.' }),
      ).toBeVisible();
      const result = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      await activate(button('Back to the neighborhood'));
      return result;
    }
    const fixture = await exported();
    // Keep the longer, owned panel with all actions, mastery and dishes.
    fixture.restaurants.noodle_nook.level = 25;
    await activate(button('Settings'));
    await page
      .getByLabel('Import a saved street')
      .fill(JSON.stringify(fixture));
    await activate(button('Restore save'));
    await expect(
      page.getByText('Street restored.', { exact: true }),
    ).toBeVisible();
    await activate(button('Back to the neighborhood'));
    async function open() {
      await activate(button('Kitchen'));
      await activate(
        page
          .getByRole('region', { name: 'Kitchen mastery', exact: true })
          .getByRole('button', { name: 'Visit Noodle Nook', exact: true }),
      );
      await page.clock.runFor(1000);
      await expect(heading).toBeFocused();
      await expect(panel).not.toHaveAttribute('aria-modal', 'true');
      await page.keyboard.press('Tab');
      await expect(close).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(button('Buy 1')).toBeFocused();
    }
    async function geometry() {
      const result = await panel.evaluate((el) => {
        const p = el.getBoundingClientRect();
        const h = el.querySelector('h2').getBoundingClientRect();
        const c = el.querySelector('[aria-label="Close restaurant"]');
        const b = c.getBoundingClientRect();
        const inside = (r) =>
          r.top >= Math.max(0, p.top) &&
          r.bottom <= Math.min(innerHeight, p.bottom) &&
          r.left >= Math.max(0, p.left) &&
          r.right <= Math.min(innerWidth, p.right);
        const hit = (node, r) =>
          [0.2, 0.5, 0.8].every((x) =>
            [0.2, 0.5, 0.8].every((y) =>
              node.contains(
                document.elementFromPoint(
                  r.left + r.width * x,
                  r.top + r.height * y,
                ),
              ),
            ),
          );
        return {
          headingVisible: inside(h) && hit(el.querySelector('h2'), h),
          closeVisible: inside(b) && hit(c, b),
          separate: h.right <= b.left || b.right <= h.left,
          width: b.width,
          height: b.height,
          overflow:
            el.scrollWidth > el.clientWidth ||
            document.documentElement.scrollWidth > innerWidth,
          x: b.x + b.width / 2,
          y: b.y + b.height / 2,
        };
      });
      expect(
        result.headingVisible,
        `${name}: named heading remains visible and unobscured after real scroll`,
      ).toBe(true);
      expect(
        result.closeVisible,
        `${name}: Close remains visible and hit-testable after real scroll`,
      ).toBe(true);
      expect(result.separate).toBe(true);
      expect(result.width).toBeGreaterThanOrEqual(44);
      expect(result.height).toBeGreaterThanOrEqual(44);
      expect(result.overflow).toBe(false);
      return result;
    }
    async function scrollStep() {
      const b = await panel.boundingBox();
      const x = b.x + b.width / 2;
      const start = Math.min(height - 12, b.y + b.height - 18);
      const distance = Math.min(60, b.height - 120);
      expect(distance).toBeGreaterThan(30);
      if (mobile) {
        // Native touch input, no DOM scrollTop assignment or locator auto-scroll.
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y: start }],
        });
        for (let i = 1; i <= 8; i++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: start - (distance * i) / 8 }],
          });
          await page.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
      } else {
        await page.mouse.move(x, start);
        await page.mouse.wheel(0, distance);
      }
      await page.waitForTimeout(150);
    }
    async function bottom() {
      let sawMastery = false;
      const seen = new Set();
      const contentSelector =
        '.restaurant-mastery h3, .restaurant-mastery strong, .restaurant-mastery p, .restaurant-mastery label, .restaurant-mastery small, .restaurant-panel > h3';
      const contentCount = await panel.evaluate(
        (el, selector) => el.querySelectorAll(selector).length,
        contentSelector,
      );
      for (let i = 0; i < 50; i++) {
        await scrollStep();
        const state = await panel.evaluate((el, selector) => {
          const p = el.getBoundingClientRect();
          const h = el.querySelector('h2').getBoundingClientRect();
          const m = el
            .querySelector('.restaurant-mastery h3')
            .getBoundingClientRect();
          return {
            visibleContent: [...el.querySelectorAll(selector)].flatMap(
              (node, index) => {
                const r = node.getBoundingClientRect();
                return r.top >= h.bottom &&
                  r.bottom <= p.bottom &&
                  node.contains(
                    document.elementFromPoint(
                      r.x + r.width / 2,
                      r.y + r.height / 2,
                    ),
                  )
                  ? [index]
                  : [];
              },
            ),
            top: el.scrollTop,
            end: el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
            mastery: m.top >= Math.max(p.top, h.bottom) && m.bottom <= p.bottom,
          };
        }, contentSelector);
        state.visibleContent.forEach((index) => seen.add(index));
        if (state.top > 0) await geometry();
        sawMastery ||= state.mastery;
        if (state.end) break;
        if (i === 49)
          throw new Error(`${name}: native scrolling never reached bottom`);
      }
      expect(sawMastery, 'Mastery heading accessible during scroll').toBe(true);
      expect(
        seen.size,
        'Every mastery disclosure and dishes heading accessible during scrolling',
      ).toBe(contentCount);
      expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      // Every dish, including the last content, fits below the sticky heading.
      expect(
        await panel.evaluate((el) => {
          const p = el.getBoundingClientRect();
          const h = el.querySelector('h2').getBoundingClientRect();
          return [...el.querySelectorAll('.dishes > div')].every((dish) => {
            const r = dish.getBoundingClientRect();
            return (
              r.top >= h.bottom &&
              r.bottom <= Math.min(p.bottom, innerHeight) &&
              dish.contains(
                document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                ),
              )
            );
          });
        }),
      ).toBe(true);
    }
    await open();
    await bottom();
    const point = await geometry();
    await page.screenshot({
      path: `test-results/reflow-${name}-root-font-simulation-imported-fixture.png`,
    });
    // Coordinates deliberately avoid Playwright's locator scroll-into-view.
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await expect(panel).toHaveCount(0);
    const plot = page
      .locator('.building-label')
      .filter({ hasText: 'Noodle Nook' });
    await expect(plot).toBeFocused();
    expect(await exported()).toEqual(fixture);
    await settings();
    await open();
    await bottom();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(plot).toBeFocused();
    await open();
    // Nonmodal Tab can leave; Escape outside the panel must not dismiss it.
    for (
      let i = 0;
      i < 60 &&
      !(await button('Settings').evaluate(
        (el) => el === document.activeElement,
      ));
      i++
    )
      await page.keyboard.press('Tab');
    await expect(button('Settings')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
    await activate(button('Settings'));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(panel).toBeVisible();
    await activate(close);
    expect(await exported()).toEqual(fixture);
    await page.reload();
    await page.clock.runFor(1000);
    expect(await exported()).toEqual(fixture);
    expect(errors).toEqual([]);
    console.log(
      `PASS reflow ${name}: root font simulation, Settings controls/native scroll/dismissal, topbar/tab coordinate actions, panel native scroll, heading/44px Close hit tests, bottom dishes, focus/Escape, exact saves/reload (Canvas fixture; not real zoom)`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
