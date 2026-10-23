import { chromium, expect } from '@playwright/test';
const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported imported fixtures, not natural progression. Canvas fixture coverage;
// existing qa.mjs separately covers normal WebGL gameplay.
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
    const activate = async (locator) => {
      if (mobile) await locator.tap();
      else {
        await locator.focus();
        await page.keyboard.press('Enter');
      }
    };
    await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-19T12:00:00Z'));
    await page.goto(`${base}/?qa=1`);
    await page.clock.runFor(1000);
    // Keep Date.now fixed for exact save/economy comparisons while permitting
    // controlled animation frames for scene remounts and street switches.
    await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
    await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    async function exported() {
      await activate(button('Settings'));
      await activate(button('Copy / download save'));
      // Clipboard writes are asynchronous; read only after the UI confirms one.
      await expect(
        page.getByRole('status').filter({
          hasText: 'Save copied to clipboard.',
        }),
      ).toBeVisible();
      const save = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      await activate(button('Back to the neighborhood'));
      return save;
    }
    const template = await exported();
    const overview = page.getByRole('region', {
      name: 'Kitchen mastery',
      exact: true,
    });
    const street = (name) =>
      overview.getByRole('region', { name, exact: true });
    const row = (name) =>
      overview.getByRole('listitem').filter({ hasText: name });
    const kitchen = async () => {
      await activate(button('Kitchen'));
      await expect(overview).toBeVisible();
    };
    async function layout() {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const action of await overview.locator('button, a').all()) {
        const box = await action.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    async function restore(fixture) {
      await activate(button('Settings'));
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify(fixture));
      await activate(button('Restore save'));
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await activate(button('Back to the neighborhood'));
      await page.clock.runFor(1000);
      await kitchen();
      expect(await exported()).toEqual(fixture);
    }
    async function visit(name, streetName, expected) {
      await kitchen();
      await activate(
        row(name).getByRole('button', { name: `Visit ${name}`, exact: true }),
      );
      await page.clock.runFor(1000);
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      await expect(page.locator('.street-sign')).toContainText(streetName);
      await expect(
        page.getByRole('complementary', { name, exact: true }),
      ).toBeVisible();
      const closeBox = await button('Close restaurant').boundingBox();
      expect(closeBox.width).toBeGreaterThanOrEqual(44);
      expect(closeBox.height).toBeGreaterThanOrEqual(44);
      await activate(button('Close restaurant'));
      expect(await exported()).toEqual(expected);
      await kitchen();
    }
    await kitchen();
    await expect(street('Maple Street mastery')).toContainText('0 / 18 badges');
    await expect(street('Riverside Market mastery')).toContainText('Locked');
    await expect(row('Noodle Nook')).toContainText('Level 1');
    await expect(row('Coffee Corner')).toContainText('Not owned');
    await expect(row('River Grill').getByRole('button')).toHaveCount(0);
    await layout();
    await activate(
      overview.getByRole('link', { name: 'View Riverside unlock goal' }),
    );
    const goal = page.getByRole('region', {
      name: 'Riverside Market',
      exact: true,
    });
    await expect(
      goal.getByRole('button', {
        name: 'Unlock Riverside Market',
        exact: true,
      }),
    ).toBeDisabled();
    await expect(page.locator('#riverside-title')).toBeFocused();
    expect(await exported()).toEqual(template);
    await visit('Coffee Corner', 'MAPLE STREET', template);

    const partial = structuredClone(template);
    partial.coins = 123456;
    partial.gems = 42;
    partial.upgrades = ['ingredients'];
    const maple = [
      'noodle_nook',
      'coffee_corner',
      'sunny_bakery',
      'taco_tuesday',
      'tomato_basil',
      'sushi_station',
    ];
    [25, 50, 100, 24, 0, 99].forEach((level, i) =>
      Object.assign(partial.restaurants[maple[i]], { owned: level > 0, level }),
    );
    await restore(partial);
    await expect(street('Maple Street mastery')).toContainText('8 / 18 badges');
    await expect(street('Maple Street mastery')).toContainText(
      '1 / 6 restaurants complete',
    );
    await expect(row('Noodle Nook')).toContainText('Apprentice');
    await expect(row('Noodle Nook')).toContainText('Next: Artisan at level 50');
    await expect(row('Sunny Bakery')).toContainText('Mastery complete');
    await expect(row('Tomato & Basil')).toContainText('Not owned');
    await visit('Sunny Bakery', 'MAPLE STREET', partial);
    await page.reload();
    await page.clock.runFor(1000);
    await kitchen();
    await expect(street('Maple Street mastery')).toContainText('8 / 18 badges');
    expect(await exported()).toEqual(partial);

    const complete = structuredClone(partial);
    maple.forEach((id) =>
      Object.assign(complete.restaurants[id], { owned: true, level: 100 }),
    );
    await restore(complete);
    await expect(street('Maple Street mastery')).toContainText(
      '18 / 18 badges',
    );
    await expect(street('Maple Street mastery')).toContainText(
      '6 / 6 restaurants complete',
    );
    await activate(
      overview.getByRole('link', { name: 'View Riverside unlock goal' }),
    );
    await expect(
      goal.getByRole('button', {
        name: 'Unlock Riverside Market',
        exact: true,
      }),
    ).toBeEnabled();
    // Explicit existing unlock action, never a Visit bypass.
    await activate(
      goal.getByRole('button', {
        name: 'Unlock Riverside Market',
        exact: true,
      }),
    );
    const unlocked = structuredClone(complete);
    unlocked.neighborhood.unlockedStreets.push('riverside_market');
    expect(await exported()).toEqual(unlocked);
    await expect(row('River Grill')).toContainText('Not owned');
    const riverside = structuredClone(unlocked);
    riverside.neighborhood.currentStreet = 'riverside_market';
    await visit('River Grill', 'RIVERSIDE MARKET', riverside);
    Object.assign(riverside.restaurants.river_grill, {
      owned: true,
      level: 50,
      register: 123,
    });
    await restore(riverside);
    await expect(street('Riverside Market mastery')).toContainText(
      '2 / 6 badges',
    );
    await expect(row('River Grill')).toContainText('Next: Master at level 100');
    await visit('Market Gelato', 'RIVERSIDE MARKET', riverside);
    const back = structuredClone(riverside);
    back.neighborhood.currentStreet = 'maple_street';
    await visit('Sushi Station', 'MAPLE STREET', back);
    await layout();
    await page.screenshot({
      path: `test-results/discovery-${mobile ? 'mobile' : 'desktop'}-imported-fixture.png`,
      fullPage: true,
    });
    await page.reload();
    await page.clock.runFor(1000);
    expect(await exported()).toEqual(back);
    await kitchen();
    await expect(street('Riverside Market mastery')).toContainText(
      '2 / 6 badges',
    );
    await activate(button('Settings'));
    await activate(button('Reset my street'));
    await activate(button('Yes, start fresh'));
    await page.clock.runFor(1000);
    await kitchen();
    await expect(street('Maple Street mastery')).toContainText('0 / 18 badges');
    await expect(street('Riverside Market mastery')).toContainText('Locked');
    await expect(row('Noodle Nook')).toContainText('Level 1');
    const reset = structuredClone(template);
    Object.values(reset.restaurants).forEach((r) => {
      r.register = 0;
    });
    expect(await exported()).toEqual(reset);
    await layout();
    expect(errors).toEqual([]);
    console.log(
      `PASS discovery ${mobile ? 'mobile taps' : 'desktop keyboard'}: fresh, partial/complete, unowned, locked/earned unlock, real cross-street visits, exact supported exports, reload/reset, 44px actions, no overflow/page errors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
