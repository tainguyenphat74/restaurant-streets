import { chromium, expect } from '@playwright/test';
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported imported fixtures, not natural-progress screenshots. Canvas matches
// other fixture suites; qa.mjs separately exercises standard WebGL gameplay.
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
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const button = (name) => page.getByRole('button', { name, exact: true });
    const activate = (locator) => (mobile ? locator.tap() : locator.click());
    const read = async () => {
      const { version, savedAt, pendingOffline, ...data } = await exported();
      expect(version).toBe(4);
      expect(pendingOffline).toBe(0);
      return data;
    };
    const now = () => page.evaluate(() => Date.now());
    await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-19T12:00:00Z'));
    await page.goto(`${base}/?qa=1`);
    await page.clock.runFor(1000);
    await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    const template = await read();
    async function restore(level, managed = false, boosted = false) {
      const data = structuredClone(template);
      Object.assign(data, {
        coins: 100000,
        gems: 42,
        boostUntil: boosted ? (await now()) + 60000 : 0,
      });
      Object.assign(data.restaurants.noodle_nook, {
        level,
        hasManager: managed,
        register: 0,
      });
      const fixture = {
        ...data,
        version: 4,
        savedAt: await now(),
        pendingOffline: 0,
      };
      await activate(button('Settings'));
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify(fixture));
      await activate(button('Restore save'));
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await activate(button('Back to the neighborhood'));
      expect(await exported()).toEqual(fixture);
      return fixture;
    }
    async function exported() {
      await activate(button('Settings'));
      await activate(button('Copy / download save'));
      const save = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      await activate(button('Back to the neighborhood'));
      return save;
    }
    async function measure(rate, managed = false) {
      const a = await exported();
      const start = await now();
      await page.clock.runFor(2000);
      const b = await exported();
      const seconds = ((await now()) - start) / 1000;
      const earned = managed
        ? b.coins - a.coins
        : b.restaurants.noodle_nook.register -
          a.restaurants.noodle_nook.register;
      expect(earned / seconds).toBeCloseTo(rate, 5);
      // Assert every saved field exactly, except measured earnings and elapsed timestamp.
      const expected = structuredClone(a);
      expected.savedAt = await now();
      if (managed) expected.coins = b.coins;
      else
        expected.restaurants.noodle_nook.register =
          b.restaurants.noodle_nook.register;
      expect(b).toEqual(expected);
    }
    const fixture = await restore(50);
    await measure(500);
    await activate(button('Kitchen'));
    const help = page.getByRole('region', {
      name: 'Plan your progress',
      exact: true,
    });
    await expect(help).toContainText('1 percentage point per level after 50');
    await expect(help).toContainText('capped at +75% at level 100');
    const visit = page.getByRole('button', {
      name: 'Visit restaurant ↗',
      exact: true,
    });
    if (mobile) await visit.tap();
    else {
      await visit.focus();
      await page.keyboard.press('Enter');
    }
    const before = await read();
    await activate(page.getByRole('button', { name: /Upgrade restaurant/ }));
    const after = await read();
    expect(after.restaurants.noodle_nook).toEqual({
      ...before.restaurants.noodle_nook,
      level: 51,
    });
    expect(after.coins).toBeCloseTo(before.coins - 10 * 1.15 ** 50, 8);
    expect(after.gems).toBe(42);
    expect(after.neighborhood).toEqual(before.neighborhood);
    expect(after.upgrades).toEqual(before.upgrades);
    expect(after.boostUntil).toBe(before.boostUntil);
    for (const id of Object.keys(after.restaurants).filter(
      (id) => id !== 'noodle_nook',
    ))
      expect(after.restaurants[id]).toEqual(before.restaurants[id]);
    await activate(button('Close restaurant'));
    await measure(515.1);
    const save = await exported();
    expect(Object.keys(save).sort()).toEqual(Object.keys(fixture).sort());
    expect(save.pendingOffline).toBe(0);
    expect(save.version).toBe(4);
    await page.reload();
    await expect(button('Kitchen')).toBeVisible();
    expect(await exported()).toEqual(save);
    await measure(515.1);
    for (const [level, rate] of [
      [75, 937.5],
      [76, 965.2],
      [90, 1395],
      [100, 3850],
      [101, 3888.5],
    ]) {
      for (const managed of [false, true]) {
        for (const boosted of [false, true]) {
          const restored = await restore(level, managed, boosted);
          await page.reload();
          expect(await exported()).toEqual(restored);
          await measure(rate * (boosted ? 2 : 1), managed);
        }
      }
    }
    await activate(button('Kitchen'));
    await expect(help).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/late-income-${mobile ? 'mobile' : 'desktop'}-imported-fixture.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
    console.log(
      `PASS late income ${mobile ? 'mobile taps' : 'desktop keyboard'}: supported fixtures, 50→51 actual upgrade, measured 500/515.1 and 75/76/90/100/101 rates, register/manager, exact export/reload, disclosure, overflow, zero page errors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
