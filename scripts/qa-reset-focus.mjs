import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to a stable production preview');
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
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const button = (name) => page.getByRole('button', { name, exact: true });
      const dialog = page.getByRole('dialog', {
        name: 'Make yourself at home',
      });
      const draft = page.getByLabel('Import a saved street');
      async function tabTo(target) {
        for (let i = 0; i < 80; i++) {
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
      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await page.clock.runFor(1000);
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      const frames = () => page.clock.runFor(1000);
      async function exported() {
        await activate(button('Copy / download save'));
        await expect(
          page
            .getByRole('status')
            .filter({ hasText: 'Save copied to clipboard.' }),
        ).toBeVisible();
        return JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
      }
      await activate(button('Settings'));
      const original = await exported();
      const fixture = {
        ...structuredClone(original),
        coins: 12345.25,
        gems: 37,
        pendingOffline: 12.5,
      };
      await draft.fill(JSON.stringify(fixture));
      await activate(button('Restore save'));
      await expect(
        page.getByText('Street restored.', { exact: true }),
      ).toBeVisible();
      await frames();
      expect(await exported()).toEqual(fixture);
      const raw = '  unfinished import draft\n{"coins": 42';
      await draft.fill(raw);
      for (const cancellation of ['button', 'Escape']) {
        await activate(button('Reset my street'));
        // Primary RED: the original Reset unmounts and leaves focus on body.
        await expect(button('Keep my street')).toBeFocused();
        await frames();
        await expect(button('Keep my street')).toBeFocused();
        const count = await dialog
          .locator('button:not(:disabled),textarea,a[href]')
          .count();
        for (const key of ['Tab', 'Shift+Tab']) {
          for (let i = 0; i < count + 1; i++) {
            await page.keyboard.press(key);
            expect(
              await dialog.evaluate((el) =>
                el.contains(document.activeElement),
              ),
            ).toBe(true);
          }
        }
        // Ticks must not steal focus from the import field during confirmation.
        await tabTo(draft);
        await frames();
        await expect(draft).toBeFocused();
        if (cancellation === 'button') await activate(button('Keep my street'));
        else await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        await expect(button('Yes, start fresh')).toHaveCount(0);
        await expect(button('Reset my street')).toBeFocused();
        await frames();
        await expect(button('Reset my street')).toBeFocused();
        await expect(draft).toHaveValue(raw);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(button('Settings')).toBeFocused();
        await frames();
        await expect(button('Settings')).toBeFocused();
        await activate(button('Settings'));
        expect(await exported()).toEqual(fixture);
        await draft.fill(raw);
      }
      await activate(button('Back to the neighborhood'));
      await expect(button('Settings')).toBeFocused();
      await activate(button('Settings'));
      await activate(button('Reset my street'));
      await expect(button('Keep my street')).toBeFocused();
      await activate(button('Yes, start fresh'));
      await expect(dialog).toHaveCount(0);
      await expect(button('Settings')).toBeFocused();
      await frames();
      await activate(button('Settings'));
      const resetExpected = structuredClone(original);
      for (const restaurant of Object.values(resetExpected.restaurants))
        restaurant.register = 0;
      expect(await exported()).toEqual(resetExpected);
      expect(errors).toEqual([]);
      console.log(
        `PASS reset focus ${mobile ? 'mobile tap' : 'desktop natural Tab/Enter'}: safe focus, bidirectional Tab confinement, button/Escape cancellation, draft, exact full saves, closing restoration, explicit reset, zero page errors`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
