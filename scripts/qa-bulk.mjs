import { chromium, expect } from '@playwright/test';

// Run against a stable production build, never the editing/HMR server.
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to the stable production build URL');
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
// Use Canvas for repeated import-boundary fixtures on headless CPU runners.
// qa.mjs covers default WebGL desktop/mobile gameplay; QA_WEBGL=1 additionally
// stress-tests these fixtures with WebGL on runners with a stable GPU driver.
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    ...(process.env.QA_WEBGL === '1' ? [] : ['--disable-webgl']),
  ],
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
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ready = () =>
      page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    const data = () => page.evaluate(() => window.restaurantQA().data);
    const open = () =>
      page.getByRole('button', { name: /Noodle Nook Lv/ }).click();
    const upgrade = page.getByRole('button', { name: /Upgrade restaurant/ });
    const mode = (name) => page.getByRole('button', { name, exact: true });
    await page.goto(`${base}/?qa=1`);
    await ready();
    // Natural progress: no imported state or clock manipulation.
    await page.waitForFunction(
      () => window.restaurantQA().data.restaurants.noodle_nook.register >= 12,
      {},
      { timeout: 60000 },
    );
    await page
      .getByRole('button', { name: 'Collect from Noodle Nook' })
      .click();
    await open();
    await expect(mode('Buy 1')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.bulk-quote')).toContainText('1 level');
    await upgrade.click();
    expect((await data()).restaurants.noodle_nook.level).toBe(2);
    await page.getByRole('button', { name: 'Close restaurant' }).click();
    await page.reload();
    await ready();
    expect((await data()).restaurants.noodle_nook.level).toBe(2);
    console.log(
      `PASS ${mobile ? 'mobile' : 'desktop'}: natural earning, default upgrade, reload`,
    );

    // Supported import UI fixtures ONLY for bulk boundary tests. No screenshots.
    const template = await data();
    async function fixture(level, coins) {
      if (
        await page.getByRole('button', { name: 'Close restaurant' }).count()
      ) {
        await page.getByRole('button', { name: 'Close restaurant' }).click();
      }
      const state = structuredClone(template);
      delete state.neighborhood; // Historical v1/v2 schema excludes v3 fields.
      Object.assign(state.restaurants.noodle_nook, {
        level,
        register: 0,
        hasManager: false,
      });
      Object.assign(state, { coins, gems: 0 });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify({ ...state, version: 1, savedAt: Date.now() }));
      await page.getByRole('button', { name: 'Restore save' }).click();
      await page
        .getByRole('button', { name: 'Back to the neighborhood' })
        .click();
      await open();
      return state;
    }
    async function purchase(name, limit) {
      console.log(
        `Checking ${mobile ? 'mobile' : 'desktop'} ${name} (${limit})`,
      );
      await mode(name).click();
      const before = await data();
      let total = 0;
      let coins = before.coins,
        level = before.restaurants.noodle_nook.level,
        count = 0,
        gems = before.gems;
      for (; count < limit && level < 1000; count++) {
        const cost = 10 * 1.15 ** level;
        if (coins < cost) break;
        coins -= cost;
        total += cost;
        level++;
        if ([10, 25, 50, 100].includes(level)) gems += 5;
      }
      await expect(page.locator('.bulk-quote')).toContainText(`${count} level`);
      await expect(page.locator('.bulk-quote')).toContainText(
        `🪙 ${format(total)}`,
      );
      if (count) await upgrade.click();
      else await expect(upgrade).toBeDisabled();
      const after = await data();
      expect(after.coins).toBe(coins);
      expect(after.gems).toBe(gems);
      expect(after.restaurants.noodle_nook.level).toBe(level);
      expect(Number.isFinite(after.coins) && after.coins >= 0).toBe(true);
    }
    await fixture(1, 25);
    // Keyboard selection and activation of an ordinary button.
    await mode('Buy 10').focus();
    await page.keyboard.press('Enter');
    await expect(mode('Buy 10')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.bulk-quote')).toContainText('2 levels');
    await purchase('Buy 10', 10);
    await expect(upgrade).toBeDisabled();
    await fixture(9, 1e6);
    await purchase('Next milestone', 1);
    await expect(page.locator('.milestone-progress')).toContainText(
      'Level 10 / 25',
    );
    await expect(page.locator('.milestone-progress')).toContainText(
      '×2 income milestone · +5 gems',
    );
    await purchase('Next milestone', 15);
    expect((await data()).gems).toBe(10);
    await fixture(1, 1e9);
    await purchase('Buy max', 999);
    expect((await data()).gems).toBe(20);
    await expect(mode('Next milestone')).toBeDisabled();
    await expect(page.locator('.milestone-progress')).toContainText(
      'All milestones complete',
    );
    await fixture(99, 1e9);
    await purchase('Next milestone', 1);
    await expect(mode('Next milestone')).toBeDisabled();
    await expect(upgrade).toBeDisabled();
    await purchase('Buy 10', 10);
    expect((await data()).gems).toBe(5);
    await fixture(1, 11.49);
    await purchase('Buy 10', 10);
    await fixture(1, 11.5);
    await purchase('Buy 1', 1);
    expect((await data()).coins).toBe(0);
    await fixture(999, 10 * 1.15 ** 999);
    await purchase('Buy max', 999);
    await expect(upgrade).toBeDisabled();
    await expect(page.locator('.milestone-progress')).toContainText(
      'Max level reached',
    );
    await expect(mode('Next milestone')).toBeDisabled();
    const saved = await data();
    await page.reload();
    await ready();
    const restored = await data();
    expect(restored.coins).toBe(saved.coins);
    expect(restored.gems).toBe(saved.gems);
    expect(restored.restaurants.noodle_nook.level).toBe(1000);
    await open();
    await expect(upgrade).toBeDisabled();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(mobile ? 390 : 1440);
    expect(errors).toEqual([]);
    console.log(
      `PASS ${mobile ? 'mobile' : 'desktop'}: imported bulk boundary fixtures, sequential balances, gems, completion, cap, reload, keyboard, no overflow; zero pageerrors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
