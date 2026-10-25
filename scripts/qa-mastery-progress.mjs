import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to stable production preview');
// Supported Settings import/export fixtures with Canvas, NOT natural progression,
// physical-device or screen-reader evidence. Never mutate the store/storage.
const streets = [
  [
    'Maple Street',
    [
      ['noodle_nook', 'Noodle Nook'],
      ['coffee_corner', 'Coffee Corner'],
      ['sunny_bakery', 'Sunny Bakery'],
      ['taco_tuesday', 'Taco Tuesday'],
      ['tomato_basil', 'Tomato & Basil'],
      ['sushi_station', 'Sushi Station'],
    ],
  ],
  [
    'Riverside Market',
    [
      ['river_grill', 'River Grill'],
      ['market_gelato', 'Market Gelato'],
    ],
  ],
];
const catalog = streets.flatMap(([, entries]) => entries);
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [320, 568],
    [667, 320],
  ]) {
    const mobile = width !== 1440;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'reduce',
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const overview = page.getByRole('region', {
        name: 'Kitchen mastery',
        exact: true,
      });
      const row = (name) =>
        overview
          .getByRole('listitem')
          .filter({ has: page.getByText(name, { exact: true }) });
      const filter = overview.getByRole('checkbox', {
        name: 'Hide completed restaurants',
        exact: true,
      });
      async function frames() {
        await page.clock.runFor(1000);
        await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
      }
      async function exported() {
        await ui(button('Settings'));
        await ui(button('Copy / download save'));
        await expect(
          page
            .getByRole('status')
            .filter({ hasText: 'Save copied to clipboard.' }),
        ).toBeVisible();
        const save = JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
        await ui(button('Back to the neighborhood'));
        return save;
      }
      async function restore(save) {
        // Keep this very overview mounted across the supported Restore action.
        const mounted = await overview.elementHandle();
        await ui(button('Settings'));
        await page
          .getByLabel('Import a saved street')
          .fill(JSON.stringify(save));
        await ui(button('Restore save'));
        await expect(
          page.getByText('Street restored.', { exact: true }),
        ).toBeVisible();
        await ui(button('Back to the neighborhood'));
        expect(await mounted.evaluate((el) => el.isConnected)).toBe(true);
        await mounted.dispose();
        expect(await exported()).toEqual(save);
      }
      async function layout(target) {
        await target.scrollIntoViewIfNeeded();
        const rect = await target.boundingBox();
        expect(rect).not.toBeNull();
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(
          await target.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        expect(
          await overview.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      async function check(save, hidden = false) {
        for (const [streetName, entries] of streets) {
          const region = overview.getByRole('region', {
            name: `${streetName} mastery`,
            exact: true,
          });
          let badges = 0,
            completed = 0;
          const visible = [];
          for (const [id, name] of entries) {
            const { owned, level } = save.restaurants[id];
            const value = owned ? level : 0;
            const earned =
              value >= 100 ? 3 : value >= 50 ? 2 : value >= 25 ? 1 : 0;
            badges += earned;
            completed += Number(earned === 3);
            if (hidden && earned === 3) {
              await expect(row(name)).toHaveCount(0);
              continue;
            }
            visible.push(name);
            const item = row(name);
            await expect(item).toContainText(
              owned ? `Level ${level}` : 'Not owned',
            );
            await expect(item).toContainText(
              ['No badge yet', 'Apprentice', 'Artisan', 'Master'][earned],
            );
            const progress = item.getByRole('progressbar');
            if (earned === 3) {
              await expect(item).toContainText('Mastery complete');
              await expect(progress).toHaveCount(0);
              await expect(item).not.toContainText('Next:');
              await expect(item).not.toContainText('Next perk');
              await expect(item).toContainText(
                /Master perk active:\s*\+10% income/i,
              );
            } else {
              const target = [25, 50, 100][earned];
              await expect(item).toContainText(
                `Next: ${['Apprentice', 'Artisan', 'Master'][earned]} at level ${target}`,
              );
              await expect(progress).toHaveCount(1);
              expect(await progress.evaluate((el) => el.tagName)).toBe(
                'PROGRESS',
              );
              // Restaurant-specific accessible names must distinguish all bars.
              await expect(progress).toHaveAccessibleName(new RegExp(name));
              const snapshot = await progress.ariaSnapshot();
              const accessibleName = snapshot.match(
                /progressbar "([^"]+)"/,
              )?.[1];
              expect(accessibleName).toBeTruthy();
              await expect(
                overview.getByRole('progressbar', {
                  name: accessibleName,
                  exact: true,
                }),
              ).toHaveCount(1);
              await expect(progress).toHaveAttribute('value', String(value));
              await expect(progress).toHaveAttribute('max', String(target));
              expect(
                await progress.evaluate((el) => [
                  el.value,
                  el.max,
                  el.position,
                ]),
              ).toEqual([value, target, value / target]);
              await expect(item).toContainText(
                /Next perk:\s*\+10% income.*Master.*(?:level\s*)?100/i,
              );
              await expect(item).not.toContainText('Master perk active');
              await layout(progress);
            }
            const visit = item.getByRole('button', {
              name: `Visit ${name}`,
              exact: true,
            });
            const unlocked = save.neighborhood.unlockedStreets.includes(
              id.startsWith('river_') || id === 'market_gelato'
                ? 'riverside_market'
                : 'maple_street',
            );
            await expect(visit).toHaveCount(unlocked ? 1 : 0);
            if (unlocked) {
              await layout(visit);
              const rect = await visit.boundingBox();
              expect(rect.width).toBeGreaterThanOrEqual(44);
              expect(rect.height).toBeGreaterThanOrEqual(44);
            } else await expect(item).toContainText('Locked');
            await layout(item);
          }
          await expect(
            region.getByRole('listitem').locator('strong'),
          ).toHaveText(visible);
          await expect(region).toContainText(
            `${badges} / ${entries.length * 3} badges earned`,
          );
          await expect(region).toContainText(
            `${completed} / ${entries.length} restaurants complete`,
          );
        }
      }
      await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-19T12:00:00Z'));
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const initial = await exported();
      await ui(button('Kitchen'));
      // Deliberate baseline RED before any new copy/fixture assumptions.
      await expect(
        row('Noodle Nook').locator('progress'),
        'Kitchen rows expose native mastery progress',
      ).toHaveCount(1);
      const header = overview.locator(':scope > p').first();
      await expect(header).toContainText(/Apprentice.*Artisan.*cosmetic/i);
      await expect(header).toContainText(/Master.*\+10%.*income/i);
      await expect(header).toContainText(/automatic/i);
      await expect(header).not.toContainText('Cosmetic badges only');
      await check(initial);
      expect(await exported()).toEqual(initial);

      const fixture = structuredClone(initial);
      Object.assign(fixture, {
        coins: 123456.25,
        gems: 42,
        upgrades: ['ingredients'],
      });
      // Validator allows unowned high levels: canonical mastery must stay zero.
      for (const [id] of catalog)
        Object.assign(fixture.restaurants[id], { owned: false, level: 100 });
      await restore(fixture);
      await check(fixture);
      await expect(
        overview.getByRole('region', {
          name: 'Riverside Market mastery',
          exact: true,
        }),
      ).toContainText('Locked');
      await ui(
        overview.getByRole('link', { name: 'View Riverside unlock goal' }),
      );
      await expect(page.locator('#riverside-title')).toBeFocused();
      expect(await exported()).toEqual(fixture);

      fixture.neighborhood.unlockedStreets = [
        'maple_street',
        'riverside_market',
      ];
      // Seven bounded imports cover every boundary on EVERY restaurant in both
      // streets; rotating levels also exercises mixed completed/unfinished rows.
      const levels = [0, 24, 25, 49, 50, 99, 100];
      for (let phase = 0; phase < levels.length; phase++) {
        catalog.forEach(([id], index) => {
          const level = levels[(phase + index) % levels.length];
          Object.assign(fixture.restaurants[id], { owned: level > 0, level });
        });
        await restore(fixture);
        await expect(filter).not.toBeChecked();
        await check(fixture);
        await filter.check();
        await check(fixture, true);
        expect(await exported()).toEqual(fixture);
        if (phase === 0) {
          const updated = structuredClone(fixture);
          updated.restaurants.noodle_nook = {
            ...updated.restaurants.noodle_nook,
            owned: true,
            level: 100,
          };
          updated.restaurants.market_gelato = {
            ...updated.restaurants.market_gelato,
            owned: true,
            level: 24,
          };
          await restore(updated);
          await expect(filter).toBeChecked();
          await check(updated, true);
          await restore(fixture);
          await expect(filter).toBeChecked();
          await check(fixture, true);
        }
        await filter.uncheck();
      }
      // Filtered visits change ONLY navigation; compare the entire save each time.
      for (const [name, streetId, sign] of [
        ['River Grill', 'riverside_market', 'RIVERSIDE MARKET'],
        ['Coffee Corner', 'maple_street', 'MAPLE STREET'],
      ]) {
        await filter.check();
        await ui(
          row(name).getByRole('button', { name: `Visit ${name}`, exact: true }),
        );
        await frames();
        await expect(overview).toHaveCount(0);
        await expect(page.locator('.street-sign')).toContainText(sign);
        await expect(
          page.getByRole('complementary', { name, exact: true }),
        ).toBeVisible();
        await ui(button('Close restaurant'));
        fixture.neighborhood.currentStreet = streetId;
        expect(await exported()).toEqual(fixture);
        await ui(button('Kitchen'));
        await expect(filter).not.toBeChecked();
        await check(fixture);
      }
      await page.reload();
      await frames();
      expect(await exported()).toEqual(fixture);
      await ui(button('Kitchen'));
      await expect(filter).not.toBeChecked();
      await check(fixture);
      expect(errors).toEqual([]);
      console.log(
        `PASS mastery progress ${width}x${height}: native named progress, both streets/all thresholds, perks, locked/unowned, mounted Restore/filter/visits, full exports/reload, 44px visits, no errors/overflow; imported Canvas fixtures, not natural progression`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
