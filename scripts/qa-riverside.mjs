import { chromium, expect } from '@playwright/test';

// Stable production preview only. Fixtures use supported import, never screenshots
// presented as natural progress. Canvas avoids headless GPU fixture stalls;
// the parent standard gameplay suite covers WebGL (optional QA_WEBGL=1 here).
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to the stable production build URL');
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const data = async () => {
      await page.getByRole('button', { name: 'Street', exact: true }).click();
      await ready();
      const state = await page.evaluate(() => window.restaurantQA().data);
      await kitchen();
      return state;
    };
    const kitchen = () =>
      page.getByRole('button', { name: 'Kitchen', exact: true }).click();
    const goal = page.getByRole('region', {
      name: 'Riverside Market',
      exact: true,
    });
    const row = (name) => goal.locator('li').filter({ hasText: name });
    const ready = () =>
      page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    async function check(completed) {
      await expect(goal).toContainText(`${completed} / 6 restaurants complete`);
      const unlock = goal.getByRole('button', {
        name: 'Unlock Riverside Market',
        exact: true,
      });
      if (completed === 6) await expect(unlock).toBeEnabled();
      else await expect(unlock).toBeDisabled();
      await expect(goal.getByRole('button', { name: /^Visit / })).toHaveCount(
        6,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(Object.keys((await data()).restaurants)).toHaveLength(8);
    }
    await page.goto(`${base}/?qa=1`);
    await ready();
    const template = await data();
    await kitchen();
    await check(0);
    await expect(row('Noodle Nook')).toContainText('Level 1 / 25');
    await expect(row('Coffee Corner')).toContainText('Not owned');
    await page.screenshot({
      path: `test-results/riverside-${mobile ? 'mobile' : 'desktop'}-fresh.png`,
      fullPage: true,
    });
    for (const button of await goal.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.width).toBeGreaterThanOrEqual(40);
    }
    // Actual fresh earning and upgrade, without clock manipulation or fixtures.
    await page.getByRole('button', { name: 'Street', exact: true }).click();
    await page.waitForFunction(
      () => window.restaurantQA().data.restaurants.noodle_nook.register >= 12,
      {},
      { timeout: 60000 },
    );
    await page
      .getByRole('button', { name: 'Collect from Noodle Nook' })
      .click();
    await kitchen();
    const visitNoodle = goal.getByRole('button', {
      name: 'Visit Noodle Nook',
      exact: true,
    });
    if (mobile) await visitNoodle.tap();
    else await visitNoodle.click();
    await page.getByRole('button', { name: /Upgrade restaurant/ }).click();
    await page.getByRole('button', { name: 'Close restaurant' }).click();
    await expect(row('Noodle Nook')).toContainText('Level 2 / 25');
    async function fixture(levels) {
      const state = structuredClone(template);
      delete state.neighborhood; // Historical v1/v2 schema excludes v3 fields.
      delete state.restaurants.river_grill;
      delete state.restaurants.market_gelato;
      Object.values(state.restaurants).forEach((r, i) =>
        Object.assign(r, {
          owned: levels[i] > 0,
          level: levels[i],
          register: 0,
          hasManager: false,
        }),
      );
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByLabel('Import a saved street').fill(
        JSON.stringify({
          ...state,
          version: 2,
          pendingOffline: 0,
          savedAt: Date.now(),
        }),
      );
      await page.getByRole('button', { name: 'Restore save' }).click();
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Back to the neighborhood' })
        .click();
      await kitchen();
      return state;
    }
    await fixture([25, 24, 0, 26, 1, 0]);
    await check(2);
    await expect(row('Taco Tuesday')).toContainText('Level 26 / 25 · Complete');
    const imported = await fixture([25, 25, 25, 25, 25, 26]);
    await check(6);
    await expect(goal).toContainText('Goal ready');
    const before = await data();
    expect(before.coins).toBe(imported.coins);
    expect(before.gems).toBe(imported.gems);
    // Navigation is accessible and has no reward/purchase side effect.
    await goal.getByRole('button', { name: 'Visit Sushi Station' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Close restaurant' }).click();
    const after = await data();
    expect(after.coins).toBe(before.coins);
    expect(after.gems).toBe(before.gems);
    expect(after.upgrades).toEqual(before.upgrades);
    for (const id of Object.keys(before.restaurants)) {
      expect(after.restaurants[id].level).toBe(before.restaurants[id].level);
      expect(after.restaurants[id].hasManager).toBe(false);
    }
    await page.reload();
    await ready();
    await kitchen();
    await check(6);
    // Earned explicit unlock is free. Advanced fixtures are never photographed.
    const tap = async (locator) => (mobile ? locator.tap() : locator.click());
    await tap(
      goal.getByRole('button', {
        name: 'Unlock Riverside Market',
        exact: true,
      }),
    );
    await expect(
      goal.getByRole('button', { name: '✓ Riverside unlocked' }),
    ).toBeDisabled();
    await tap(goal.getByRole('button', { name: 'Visit Riverside Market ↗' }));
    await ready();
    await expect(page.locator('.street-sign')).toContainText(
      'RIVERSIDE MARKET',
    );
    await expect(page.locator('.building-label')).toHaveCount(2);
    expect((await page.evaluate(() => window.restaurantQA().data)).coins).toBe(
      before.coins,
    );
    const expansion = await page.evaluate(() => window.restaurantQA().data);
    expansion.coins = 1e12;
    // Normal import funds purchases without pretending these are natural earnings.
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Import a saved street').fill(
      JSON.stringify({
        ...expansion,
        version: 4,
        savedAt: Date.now(),
        pendingOffline: 123.25,
      }),
    );
    await page.getByRole('button', { name: 'Restore save' }).click();
    await expect(
      page.getByText('Street restored.', { exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Back to the neighborhood' })
      .click();
    await page.getByRole('button', { name: 'Collect earnings' }).click();
    await expect(
      page.getByRole('button', { name: 'Collect earnings' }),
    ).toHaveCount(0);
    await ready();
    for (const [id, name] of [
      ['river_grill', 'River Grill'],
      ['market_gelato', 'Market Gelato'],
    ]) {
      await tap(
        page.locator('.building-label').filter({ hasText: 'For Sale' }).first(),
      );
      await tap(page.getByRole('button', { name: /Buy restaurant/ }));
      await tap(page.getByRole('button', { name: 'Buy 10', exact: true }));
      await tap(page.getByRole('button', { name: /Upgrade restaurant/ }));
      await page.getByRole('button', { name: 'Close restaurant' }).click();
      await page.waitForFunction(
        (id) => window.restaurantQA().data.restaurants[id].register > 0,
        id,
      );
      await tap(page.getByRole('button', { name: `Collect from ${name}` }));
      expect(
        (await page.evaluate(() => window.restaurantQA().data)).restaurants[id]
          .level,
      ).toBe(11);
      await kitchen();
      await tap(
        page
          .locator('.card')
          .filter({ has: page.getByRole('heading', { name, exact: true }) })
          .getByRole('button', { name: /Hire manager/ }),
      );
      await page.getByRole('button', { name: 'Street', exact: true }).click();
      await ready();
      expect(
        (await page.evaluate(() => window.restaurantQA().data)).restaurants[id]
          .hasManager,
      ).toBe(true);
    }
    const balance = await page.evaluate(() => window.restaurantQA().data.coins);
    await tap(page.getByRole('button', { name: 'Maple Street', exact: true }));
    await ready();
    await expect(page.locator('.building-label')).toHaveCount(6);
    await page.waitForFunction(
      (coins) => window.restaurantQA().data.coins > coins,
      balance,
    );
    await tap(page.getByRole('button', { name: /Noodle Nook Lv/ }));
    await tap(page.getByRole('button', { name: 'Buy 10', exact: true }));
    await tap(page.getByRole('button', { name: /Upgrade restaurant/ }));
    await page.getByRole('button', { name: 'Close restaurant' }).click();
    await tap(
      page.getByRole('button', { name: 'Riverside Market', exact: true }),
    );
    await ready();
    await page.reload();
    await ready();
    await expect(page.locator('.street-sign')).toContainText(
      'RIVERSIDE MARKET',
    );
    expect(
      (await page.evaluate(() => window.restaurantQA().data)).restaurants
        .noodle_nook.level,
    ).toBe(35);
    // Real reload time may earn a new small offline award from the managers.
    const reloadAward = page.getByRole('button', { name: 'Collect earnings' });
    if (await reloadAward.isVisible()) await reloadAward.click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await page.locator('.street-switch button').all()) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Reset my street' }).click();
    await page.getByRole('button', { name: 'Yes, start fresh' }).click();
    await kitchen();
    await check(0);
    await expect(row('Noodle Nook')).toContainText('Level 1 / 25');
    expect(errors).toEqual([]);
    console.log(
      `PASS ${mobile ? 'mobile' : 'desktop'} Riverside: fresh, natural upgrade, imported partial/ready, earned unlock, two Riverside purchases/bulk/collection/managers, background income, street switch/reload, pending claim, reset, mobile taps, no overflow or page errors. No fixture images.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
