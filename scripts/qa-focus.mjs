import { chromium, expect } from '@playwright/test';
const strictMode = process.env.QA_STRICT_MODE === '1';
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported imports/exports; Canvas fixtures, not natural progression.
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
    if (strictMode) {
      // Observe real calls without simulating replay or changing focus behavior.
      await context.addInitScript(() => {
        const focus = HTMLElement.prototype.focus;
        window.__headingFocusCalls = new WeakMap();
        HTMLElement.prototype.focus = function (...args) {
          if (this.matches('.restaurant-panel h2')) {
            const calls = window.__headingFocusCalls;
            calls.set(this, (calls.get(this) || 0) + 1);
          }
          return focus.apply(this, args);
        };
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    // Walk the real sequential focus order, including from Kitchen nav to Visit.
    async function tabTo(target) {
      for (let i = 0; i < 100; i++) {
        if (await target.evaluate((el) => el === document.activeElement))
          return;
        await page.keyboard.press('Tab');
      }
      throw new Error(
        `Natural Tab did not reach ${await target.textContent()}`,
      );
    }
    async function activate(target) {
      if (mobile) await target.tap();
      else {
        await tabTo(target);
        await page.keyboard.press('Enter');
      }
    }
    const panel = (name) =>
      page.getByRole('complementary', { name, exact: true });
    const heading = (name) => panel(name).getByRole('heading', { level: 2 });
    // Works on old production too: no new runtime selector needed for RED.
    const plot = (name) =>
      page.locator('.building-label').filter({ hasText: name });
    await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-23T12:00:00Z'));
    await page.goto(`${base}/?qa=1`);
    await page.clock.runFor(1000);
    await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
    async function frames() {
      await page.clock.runFor(1000);
    }
    async function exported() {
      await activate(button('Settings'));
      await activate(button('Copy / download save'));
      await expect(
        page
          .getByRole('status')
          .filter({ hasText: 'Save copied to clipboard.' }),
      ).toBeVisible();
      const save = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      await activate(button('Back to the neighborhood'));
      return save;
    }
    const original = await exported();
    // Existing Kitchen cards open a nonmodal panel without mounting a map.
    await activate(button('Kitchen'));
    const kitchenVisit = button('Visit restaurant ↗').first();
    await activate(kitchenVisit);
    await expect(heading('Noodle Nook')).toBeFocused();
    if (strictMode) {
      // Production cannot satisfy this: React development StrictMode runs the
      // mount effect twice on the same DOM node before any user dismissal.
      await expect
        .poll(() =>
          heading('Noodle Nook').evaluate((el) =>
            window.__headingFocusCalls.get(el),
          ),
        )
        .toBe(2);
    }
    await page.keyboard.press('Escape');
    await expect(kitchenVisit).toBeFocused();
    // Reopening and keyed selection changes must each retain their own opener.
    const coffeeVisit = button('Visit restaurant ↗').nth(1);
    for (let round = 0; round < 2; round++) {
      await activate(kitchenVisit);
      await expect(heading('Noodle Nook')).toBeFocused();
      // The mobile sheet can cover Kitchen cards; dismiss with a real tap.
      // Desktop changes the keyed selection while the old panel is open.
      if (mobile) {
        await activate(button('Close restaurant'));
        await expect(kitchenVisit).toBeFocused();
      }
      await activate(coffeeVisit);
      await expect(heading('Coffee Corner')).toBeFocused();
      await expect(panel('Noodle Nook')).toHaveCount(0);
      await activate(button('Close restaurant'));
      await expect(coffeeVisit).toBeFocused();
      await frames();
      await expect(coffeeVisit).toBeFocused();
    }
    expect(await exported()).toEqual(original);
    // Dismiss before Phaser has received frames to project map controls.
    await activate(
      page
        .getByRole('region', { name: 'Kitchen mastery', exact: true })
        .getByRole('button', { name: 'Visit Noodle Nook', exact: true }),
    );
    await expect(heading('Noodle Nook')).toBeFocused();
    expect(await plot('Noodle Nook').count()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(button('Maple Street')).toBeFocused();
    await frames();
    await expect(button('Maple Street')).toBeFocused();
    expect(await exported()).toEqual(original);
    async function visit(name) {
      await activate(button('Kitchen'));
      const overview = page.getByRole('region', {
        name: 'Kitchen mastery',
        exact: true,
      });
      await activate(
        overview.getByRole('button', { name: `Visit ${name}`, exact: true }),
      );
      await expect(heading(name)).toBeFocused(); // Primary production RED assertion.
      await expect(heading(name)).toHaveAttribute('tabindex', '-1');
      await frames();
      await expect(heading(name)).toBeFocused();
      await expect(panel(name)).not.toHaveAttribute('aria-modal', 'true');
      await page.keyboard.press('Tab');
      await expect(button('Close restaurant')).toBeFocused();
      const box = await button('Close restaurant').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      const outline = await button('Close restaurant').evaluate(
        (el) => getComputedStyle(el).outlineStyle,
      );
      expect(outline).not.toBe('none');
      await frames();
      await expect(button('Close restaurant')).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await visit('Noodle Nook');
    await page.keyboard.press('Escape');
    await expect(panel('Noodle Nook')).toHaveCount(0);
    await expect(plot('Noodle Nook')).toBeFocused();
    expect(await exported()).toEqual(original);
    // Locked routing stays locked and preserves the entire exported save.
    await activate(button('Kitchen'));
    const overview = page.getByRole('region', {
      name: 'Kitchen mastery',
      exact: true,
    });
    await expect(
      overview.getByRole('button', { name: 'Visit River Grill', exact: true }),
    ).toHaveCount(0);
    await activate(
      overview.getByRole('link', { name: 'View Riverside unlock goal' }),
    );
    await expect(button('Unlock Riverside Market')).toBeDisabled();
    expect(await exported()).toEqual(original);

    const fixture = structuredClone(original);
    Object.values(fixture.restaurants).forEach((r) =>
      Object.assign(r, { owned: true, level: 25 }),
    );
    fixture.neighborhood.unlockedStreets.push('riverside_market');
    await activate(button('Settings'));
    await page
      .getByLabel('Import a saved street')
      .fill(JSON.stringify(fixture));
    await activate(button('Restore save'));
    await expect(
      page.getByText('Street restored.', { exact: true }),
    ).toBeVisible();
    await activate(button('Back to the neighborhood'));
    await visit('Noodle Nook');
    // Tab reaches actions and can leave this nonmodal panel.
    await page.keyboard.press('Tab');
    await expect(button('Buy 1')).toBeFocused();
    await tabTo(button('Settings'));
    await page.keyboard.press('Escape');
    await expect(panel('Noodle Nook')).toBeVisible();
    await activate(button('Settings'));
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button('Settings')).toBeFocused();
    await expect(panel('Noodle Nook')).toBeVisible();
    await activate(button('Close restaurant'));
    await expect(plot('Noodle Nook')).toBeFocused();
    for (const name of ['Noodle Nook', 'Coffee Corner', 'Noodle Nook']) {
      // On mobile the existing bottom sheet covers some map plots; dismiss it
      // with a real tap before selecting the next one (never force through it).
      if (mobile && (await button('Close restaurant').count())) {
        await activate(button('Close restaurant'));
      }
      await activate(plot(name));
      await expect(heading(name)).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(plot('Noodle Nook')).toBeFocused();
    await visit('Coffee Corner');
    await activate(button('Kitchen'));
    await expect(panel('Coffee Corner')).toHaveCount(0);
    if (!mobile) await expect(button('Kitchen')).toBeFocused();
    await frames();
    if (!mobile) await expect(button('Kitchen')).toBeFocused();
    await visit('River Grill');
    await activate(button('Close restaurant'));
    await expect(plot('River Grill')).toBeFocused();
    const expected = structuredClone(fixture);
    expected.neighborhood.currentStreet = 'riverside_market';
    expect(await exported()).toEqual(expected);
    await activate(plot('River Grill'));
    if (mobile) await activate(button('Close restaurant'));
    await activate(button('Maple Street'));
    await frames();
    await expect(panel('River Grill')).toHaveCount(0);
    if (!mobile) await expect(button('Maple Street')).toBeFocused();
    expect(await exported()).toEqual(fixture);
    await page.reload();
    await frames();
    expect(await exported()).toEqual(fixture);
    await visit('Noodle Nook');
    await page.screenshot({
      path: `test-results/focus-${mobile ? 'mobile' : 'desktop'}-imported-fixture.png`,
    });
    await activate(button('Close restaurant'));
    await expect(plot('Noodle Nook')).toBeFocused();
    expect(errors).toEqual([]);
    console.log(
      `PASS focus ${mobile ? 'mobile taps' : 'desktop natural Tab'}: heading, close/Escape, live restoration, selection/reopen, ticks, nonmodal exit, Settings, navigation, 44px, overflow, exact saves/reload, locked routes`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
