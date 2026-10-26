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
    async function restore(id, level, managed) {
      const fixture = structuredClone(template);
      fixture.coins =
        (id === 'river_grill' ? 12000000 : 10) * 1.15 ** 99 + 10000;
      fixture.gems = 42;
      fixture.savedAt = await page.evaluate(() => Date.now());
      fixture.neighborhood.unlockedStreets = [
        'maple_street',
        'riverside_market',
      ];
      fixture.neighborhood.currentStreet =
        id === 'river_grill' ? 'riverside_market' : 'maple_street';
      // Every neighbor stays at 25: neither street earns a new Honor.
      for (const r of Object.values(fixture.restaurants))
        Object.assign(r, {
          owned: true,
          level: 25,
          hasManager: false,
          register: 0,
        });
      Object.assign(fixture.restaurants[id], { level, hasManager: managed });
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
      await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      return fixture;
    }
    const mastery = page.getByRole('region', {
      name: 'Restaurant mastery',
      exact: true,
    });
    async function open(name) {
      await activate(
        page.getByRole('button', { name: new RegExp(`^${name}.*Lv`) }),
      );
      await expect(mastery).toBeVisible();
    }
    await open('Noodle Nook');
    await expect(mastery).toContainText('Next: Apprentice at level 25');
    // First feature assertion: old production must fail here after navigation.
    await expect(mastery).toContainText(
      'Next perk: +10% income for this restaurant at Master (level 100).',
    );
    await activate(button('Close restaurant'));
    for (const [id, name, cost] of [
      ['noodle_nook', 'Noodle Nook', 10],
      ['river_grill', 'River Grill', 12000000],
    ]) {
      for (const managed of [false, true]) {
        const target = 100,
          badge = 'Master';
        const fixture = await restore(id, 99, managed);
        await open(name);
        await expect(mastery).toContainText(
          'Next perk: +10% income for this restaurant at Master (level 100).',
        );
        await expect(mastery.getByRole('progressbar')).toHaveAttribute(
          'value',
          String(target - 1),
        );
        await expect(mastery.getByRole('progressbar')).toHaveAttribute(
          'max',
          String(target),
        );
        const before = await exported();
        expect(before).toEqual(fixture);
        await activate(
          page.getByRole('button', { name: /Upgrade restaurant/ }),
        );
        await expect(mastery).toContainText(`${badge} · Earned`);
        await expect(mastery).toContainText(
          'Master perk active: +10% income for this restaurant.',
        );
        await expect(mastery).toContainText('Mastery complete');
        await expect(mastery.getByRole('progressbar')).toHaveCount(0);
        await expect(mastery.getByRole('button')).toHaveCount(0);
        const after = await exported();
        const expected = structuredClone(before);
        expected.coins -= cost * 1.15 ** (target - 1);
        expected.gems += 5;
        expected.restaurants[id].level = target;
        expect(after).toEqual(expected);
        // All other restaurants, currency rewards, schema and timestamps compared above.
        await activate(button('Close restaurant'));
        await page.reload();
        expect(await exported()).toEqual(after);
        // Exact saved progress is checked before advancing the paused frame clock.
        // Phaser needs animation frames after reload to rebuild map hit targets.
        await page.clock.runFor(1000);
        await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
        await open(name);
        await expect(mastery).toContainText(`${badge} · Earned`);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await mastery.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/master-perk-${mobile ? 'mobile' : 'desktop'}-${id}-${managed ? 'managed' : 'register'}-imported-Canvas-fixture.png`,
        });
        await activate(button('Close restaurant'));
        // Reopening and repeated reloads must never replay gems or a perk claim.
        await open(name);
        expect(await exported()).toEqual(after);
        await activate(button('Close restaurant'));
        await page.reload();
        await page.clock.runFor(1000);
        expect(await exported()).toEqual(after);
        await measure(id, managed, 3850);
        // Independently check unchanged pre-Master income under the same fixture.
        await restore(id, 99, managed);
        await measure(id, managed, 1712.7);
      }
    }
    async function measure(id, managed, targetRate) {
      const before = await exported();
      // Advance wall time in one-second intervals (within the tick catch-up cap),
      // then allow scene/timer frames while Date remains fixed for all UI actions.
      for (let i = 0; i < 2; i++) {
        await page.clock.setFixedTime(
          (await page.evaluate(() => Date.now())) + 1000,
        );
        await page.clock.runFor(1000);
      }
      const after = await exported();
      const expected = structuredClone(before);
      expected.savedAt += 2000;
      // Literal catalog base rates; no runtime economy imports or writable hooks.
      const bases = {
        noodle_nook: 1,
        coffee_corner: 5,
        sunny_bakery: 40,
        taco_tuesday: 300,
        tomato_basil: 2500,
        sushi_station: 25000,
        river_grill: 90000,
        market_gelato: 400000,
      };
      for (const [key, baseRate] of Object.entries(bases)) {
        // Level 25: 25 × 4 milestone × (4.75 rating / 4) = 118.75.
        const earned = baseRate * (key === id ? targetRate : 118.75) * 2;
        if (key === id && managed) expected.coins += earned;
        else expected.restaurants[key].register += earned;
        // Compare money independently; tolerate only floating arithmetic rounding.
        expect(after.restaurants[key].register).toBeCloseTo(
          expected.restaurants[key].register,
          5,
        );
        expected.restaurants[key].register = after.restaurants[key].register;
      }
      // Large River purchase balances have sub-cent IEEE-754 rounding.
      expect(after.coins).toBeCloseTo(expected.coins, 1);
      expected.coins = after.coins;
      expect(after).toEqual(expected);
      await page.reload();
      expect(await exported()).toEqual(after);
      await page.clock.runFor(1000);
    }
    await activate(button('Settings'));
    await activate(button('Reset my street'));
    await activate(button('Yes, start fresh'));
    await page.clock.runFor(1000);
    await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    await open('Noodle Nook');
    await expect(mastery).toContainText('No badges earned yet');
    await expect(mastery).toContainText(
      'Next perk: +10% income for this restaurant at Master (level 100).',
    );
    await expect(mastery.getByRole('progressbar')).toHaveAttribute(
      'value',
      '1',
    );
    expect(errors).toEqual([]);
    console.log(
      `PASS Master perk ${mobile ? 'mobile taps' : 'desktop keyboard'}: imported fixtures, Canvas, both streets managed/unmanaged actual 99→100, independent rates and isolation, export/reload/reset, no claim replay/complete, no overflow/page errors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
