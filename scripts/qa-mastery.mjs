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
    await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
    async function exported() {
      await activate(button('Settings'));
      await activate(button('Copy / download save'));
      const save = JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
      await activate(button('Back to the neighborhood'));
      return save;
    }
    const template = await exported();
    async function restore(id, level) {
      const fixture = structuredClone(template);
      fixture.coins = 1e15;
      fixture.gems = 42;
      fixture.neighborhood.unlockedStreets = [
        'maple_street',
        'riverside_market',
      ];
      fixture.neighborhood.currentStreet =
        id === 'river_grill' ? 'riverside_market' : 'maple_street';
      // Unlock prerequisite is earned in this explicitly imported fixture.
      for (const [key, r] of Object.entries(fixture.restaurants)) {
        if (!['river_grill', 'market_gelato'].includes(key))
          Object.assign(r, { owned: true, level: 25 });
      }
      Object.assign(fixture.restaurants[id], { owned: true, level });
      await activate(button('Settings'));
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify(fixture));
      await activate(button('Restore save'));
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await activate(button('Back to the neighborhood'));
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
    await expect(mastery).toContainText('Cosmetic recognition only');
    await expect(mastery).toContainText(
      'Existing milestone rewards and late-level income are unchanged',
    );
    await activate(button('Close restaurant'));
    for (const [id, name, cost] of [
      ['noodle_nook', 'Noodle Nook', 10],
      ['river_grill', 'River Grill', 12000000],
    ]) {
      for (const [target, badge, next] of [
        [25, 'Apprentice', 'Artisan'],
        [50, 'Artisan', 'Master'],
        [100, 'Master', ''],
      ]) {
        await restore(id, target - 1);
        await open(name);
        await expect(mastery.getByRole('progressbar')).toHaveAttribute(
          'value',
          String(target - 1),
        );
        await expect(mastery.getByRole('progressbar')).toHaveAttribute(
          'max',
          String(target),
        );
        const before = await exported();
        await activate(
          page.getByRole('button', { name: /Upgrade restaurant/ }),
        );
        await expect(mastery).toContainText(`${badge} · Earned`);
        if (next) await expect(mastery).toContainText(`Next: ${next}`);
        else {
          await expect(mastery).toContainText('Mastery complete');
          await expect(mastery.getByRole('progressbar')).toHaveCount(0);
        }
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
        await open(name);
        await expect(mastery).toContainText(`${badge} · Earned`);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await mastery.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/mastery-${mobile ? 'mobile' : 'desktop'}-${id}-${target}-imported-fixture.png`,
        });
        await activate(button('Close restaurant'));
      }
    }
    // Other Riverside plot remains unowned despite the adjacent Master.
    await activate(page.getByRole('button', { name: /^For Sale/ }));
    await expect(mastery).toContainText('Buy this restaurant to begin');
    await expect(mastery).toContainText('No badges earned yet');
    await expect(mastery.getByRole('progressbar')).toHaveAttribute(
      'value',
      '0',
    );
    await activate(button('Close restaurant'));
    await activate(button('Settings'));
    await activate(button('Reset my street'));
    await activate(button('Yes, start fresh'));
    await open('Noodle Nook');
    await expect(mastery).toContainText('No badges earned yet');
    await expect(mastery.getByRole('progressbar')).toHaveAttribute(
      'value',
      '1',
    );
    expect(errors).toEqual([]);
    console.log(
      `PASS mastery ${mobile ? 'mobile taps' : 'desktop keyboard'}: imported fixtures, both streets actual 24→25/49→50/99→100, isolation, export/reload/reset, unowned/complete, no overflow/page errors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
