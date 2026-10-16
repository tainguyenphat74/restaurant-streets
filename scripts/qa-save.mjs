import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to a stable local production build URL');
// Same Canvas fixture path as qa-bulk; qa.mjs retains default WebGL coverage.
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
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Freeze wall time and timers so exact balances/registers and pending claims
    // can be compared without incidental online/offline earnings between clicks.
    const now = 1800000000000;
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    await page.goto(`${base}/?qa=1`);
    await page.clock.runFor(1000);
    const settings = () =>
      page.getByRole('button', { name: 'Settings', exact: true }).click();
    const back = () =>
      page.getByRole('button', { name: 'Back to the neighborhood' }).click();
    async function restore(value, valid = true) {
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify(value));
      await page.getByRole('button', { name: 'Restore save' }).click();
      await expect(
        page.getByRole('status').filter({
          hasText: valid ? 'Street restored.' : 'Invalid or unsupported save.',
        }),
      ).toBeVisible();
    }
    async function exported() {
      await page.getByRole('button', { name: 'Copy / download save' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Save copied' }),
      ).toBeVisible();
      return JSON.parse(
        await page.evaluate(() => navigator.clipboard.readText()),
      );
    }
    await settings();
    const initial = await exported();
    const v1 = {
      ...structuredClone(initial),
      version: 1,
      coins: 12345.25,
      gems: 99,
      savedAt: now - 100000,
      boostUntil: now + 200000,
      upgrades: ['ingredients', 'service'],
      pendingOffline: 432.125,
    };
    Object.values(v1.restaurants).forEach((r, i) =>
      Object.assign(r, {
        owned: true,
        level: [1, 10, 25, 50, 100, 1000][i],
        hasManager: i % 2 === 0,
        register: i + 0.125,
      }),
    );
    await restore(v1);
    const migrated = await exported();
    expect(migrated).toEqual({ ...v1, version: 2, savedAt: now + 1000 });
    await restore(migrated);
    expect(await exported()).toEqual(migrated);
    for (const bad of [
      { ...v1, version: 99 },
      { ...v1, version: '1' },
      { ...v1, coins: -1 },
      { ...migrated, pendingOffline: null },
      {
        ...v1,
        restaurants: {
          ...v1.restaurants,
          noodle_nook: { ...v1.restaurants.noodle_nook, unexpected: true },
        },
      },
    ]) {
      await restore(bad, false);
      expect(await exported()).toEqual(migrated);
    }
    await back();
    await page.reload();
    await expect(page.locator('.offline-award')).toContainText('432.1');
    await page.getByRole('button', { name: 'Collect earnings' }).click();
    await expect(
      page.getByRole('button', { name: 'Collect earnings' }),
    ).toHaveCount(0);
    await settings();
    const claimed = await exported();
    const expectedClaim = structuredClone(migrated);
    expectedClaim.coins += expectedClaim.pendingOffline;
    expectedClaim.pendingOffline = 0;
    // The existing pagehide tick collects managed registers even at zero elapsed
    // time. Assert their exact transfer to coins, rather than treating it as loss.
    for (const r of Object.values(expectedClaim.restaurants)) {
      if (r.hasManager) {
        expectedClaim.coins += r.register;
        r.register = 0;
      }
    }
    expect(claimed).toEqual(expectedClaim);
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Collect earnings' }),
    ).toHaveCount(0);
    await settings();
    expect(await exported()).toEqual(claimed);
    await page.getByRole('button', { name: 'Reset my street' }).click();
    await page.getByRole('button', { name: 'Yes, start fresh' }).click();
    await settings();
    const resetExpected = structuredClone(initial);
    resetExpected.restaurants.noodle_nook.register = 0;
    expect(await exported()).toEqual(resetExpected);
    // Seed actual browser storage, then boot through the normal load path.
    for (const [raw, recovery] of [
      ['{ broken raw save  ', 'reset'],
      [JSON.stringify({ ...initial, version: 99 }, null, 2), 'import'],
    ]) {
      // Leave the app before seeding so the previous pagehide cannot overwrite it.
      await page.goto(base + '/favicon.ico');
      await page.evaluate(
        (raw) => localStorage.setItem('restaurant-streets-save', raw),
        raw,
      );
      await page.goto(base + '/?qa=1');
      const stored = () =>
        page.evaluate(() => localStorage.getItem('restaurant-streets-save'));
      const warning = page.locator('.storage-warning');
      await expect(warning).toContainText(
        'Original raw save remains untouched',
      );
      expect(await stored()).toBe(raw);
      // Advance past the autosave deadline, firing each due timer once.
      await page.clock.fastForward(11000);
      expect(await stored()).toBe(raw);
      await page.reload();
      await expect(warning).toContainText('import a valid save');
      expect(await stored()).toBe(raw);
      await settings();
      await restore({ version: 99 }, false);
      await page.getByRole('button', { name: 'Copy / download save' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Export paused:' }),
      ).toBeVisible();
      // Advance past the autosave deadline, firing each due timer once.
      await page.clock.fastForward(11000);
      expect(await stored()).toBe(raw);
      if (recovery === 'import') {
        await restore({ ...initial, coins: 321 });
        await back();
      } else {
        await page.getByRole('button', { name: 'Reset my street' }).click();
        await page.getByRole('button', { name: 'Yes, start fresh' }).click();
      }
      await expect(warning).toHaveCount(0);
      expect(JSON.parse(await stored()).coins).toBe(
        recovery === 'import' ? 321 : 0,
      );
      const checkpoint = JSON.parse(await stored()).savedAt;
      // Advance past the autosave deadline, firing each due timer once.
      await page.clock.fastForward(11000);
      expect(JSON.parse(await stored()).savedAt).toBeGreaterThan(checkpoint);
      await page.reload();
      await expect(warning).toHaveCount(0);
      expect(JSON.parse(await stored()).coins).toBe(
        recovery === 'import' ? 321 : 0,
      );
    }
    expect(errors).toEqual([]);
    console.log(
      `PASS ${mobile ? 'mobile' : 'desktop'}: v1 migration/export/reload, v2 roundtrip, atomic invalid rejection, single pending claim/reload, reset; corrupt/unsupported boot/autosave/reload/invalid import protection and explicit recovery; zero pageerrors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
