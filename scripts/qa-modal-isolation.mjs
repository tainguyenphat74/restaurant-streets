import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to a stable production preview');
// Supported save UI + fixed wall time + Canvas: fixture evidence only.
// Fresh real-time WebGL earning remains the responsibility of unchanged qa.mjs.
// No store writes, writable QA hooks, focus shims, or synthetic DOM clicks.
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
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const mode = mobile ? 'mobile coordinate touch' : 'desktop natural Tab';
      const button = (name) => page.getByRole('button', { name, exact: true });
      const settings = button('Settings');
      const dialog = page.getByRole('dialog');
      const draft = page.getByLabel('Import a saved street');
      const panel = page.locator('.restaurant-panel');
      const plot = (id) => page.locator(`#restaurant-plot-${id}`);
      const frames = () => page.clock.runFor(1000);
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
      async function restore(save) {
        await draft.fill(JSON.stringify(save));
        await activate(button('Restore save'));
        await expect(
          page.getByText('Street restored.', { exact: true }),
        ).toBeVisible();
        await frames();
        expect(
          await exported(),
          'Supported import/export must preserve the entire fixture',
        ).toEqual(save);
      }
      async function fullSave(expected) {
        await activate(settings);
        expect(await exported()).toEqual(expected);
        await activate(button('Back to the neighborhood'));
        await expect(settings).toBeFocused();
      }
      // Read the native property on every ancestor, not just the attribute on
      // the target. aria-hidden, aria-modal and a JS Tab loop are insufficient.
      const nativeInert = (el) => {
        for (let node = el; node; node = node.parentElement) {
          if (node instanceof HTMLElement && node.inert) return true;
        }
        return false;
      };
      async function targets(restaurant) {
        const entries = [
          ['background navigation', button('Upgrades')],
          ['background Settings opener', settings],
          ['background restaurant selection', restaurant],
        ];
        if (await panel.count()) {
          entries.push(['background panel close', button('Close restaurant')]);
          entries.push([
            'background register collection',
            panel.getByRole('button', { name: /^Collect / }),
          ]);
        }
        const result = [];
        for (const [label, locator] of entries) {
          const handle = await locator.elementHandle();
          expect(handle, `${label} exists before opening modal`).not.toBeNull();
          expect(
            await handle.evaluate(nativeInert),
            `${label} starts outside inert ancestry`,
          ).toBe(false);
          expect(
            await handle.evaluate((el) => {
              el.focus({ preventScroll: true });
              return document.activeElement === el;
            }),
            `${label} really accepts native focus before isolation`,
          ).toBe(true);
          result.push({ label, handle });
        }
        return result;
      }
      async function confined() {
        const count = await dialog
          .locator('button:not(:disabled),textarea,a[href]')
          .count();
        for (const key of ['Tab', 'Shift+Tab']) {
          for (let i = 0; i <= count; i++) {
            await page.keyboard.press(key);
            expect(
              await dialog.evaluate((el) =>
                el.contains(document.activeElement),
              ),
              `${key} stays inside usable dialog`,
            ).toBe(true);
          }
        }
      }
      async function isolated(background, tab, selected) {
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(
          await dialog.evaluate(nativeInert),
          'Dialog itself must not inherit inert',
        ).toBe(false);
        for (const { label, handle } of background) {
          // Primary behavioral RED on unchanged runtime, after real navigation,
          // successful supported fixture roundtrip and a selected restaurant.
          expect(
            await handle.evaluate(nativeInert),
            `${mode}: ${label} needs native .inert ancestry; aria-modal/Tab trap alone does not isolate the background (supported Canvas fixture)`,
          ).toBe(true);
          expect(
            await handle.evaluate((el) => {
              const before = document.activeElement;
              el.focus({ preventScroll: true });
              return {
                accepted: document.activeElement === el,
                unchanged: document.activeElement === before,
              };
            }),
            `${label}: actual DOM focus() must be rejected by native inert`,
          ).toEqual({ accepted: false, unchanged: true });
          expect(
            await dialog.evaluate((el) => el.contains(document.activeElement)),
          ).toBe(true);
        }
        await confined();
        // Real pointer input at background geometry, with no force click and no
        // event dispatch. Never accidentally activate a dialog action whose
        // rectangle covers a background target. Nav + Settings are mandatory;
        // additional restaurant/panel points are tested wherever exposed.
        const clicked = [];
        for (const { label, handle } of background) {
          const point = await handle.evaluate((el) => {
            const b = el.getBoundingClientRect();
            const d = document
              .querySelector('[role="dialog"]')
              .getBoundingClientRect();
            for (const fx of [0.5, 0.1, 0.9])
              for (const fy of [0.5, 0.1, 0.9]) {
                const x = b.x + b.width * fx,
                  y = b.y + b.height * fy;
                if (
                  x > 0 &&
                  x < innerWidth &&
                  y > 0 &&
                  y < innerHeight &&
                  (x < d.left || x > d.right || y < d.top || y > d.bottom)
                )
                  return { x, y };
              }
            return null;
          });
          if (!point) continue;
          if (mobile) await page.touchscreen.tap(point.x, point.y);
          else await page.mouse.click(point.x, point.y);
          clicked.push(label);
          await expect(dialog).toBeVisible();
          await expect(
            page.locator('.topbar nav [aria-current="page"]'),
          ).toHaveAttribute('aria-label', tab);
          await expect(panel).toHaveCount(selected ? 1 : 0);
          if (selected)
            await expect(panel.locator('h2')).toContainText(selected);
        }
        expect(
          clicked,
          'Real background coordinate probes must include navigation and Settings',
        ).toEqual(
          expect.arrayContaining([
            'background navigation',
            'background Settings opener',
          ]),
        );
        // A backdrop click can legitimately blur the dialog. Native focus must
        // still work inside it, and subsequent natural Tab must be confined.
        const action = dialog.locator('button').first();
        await tabTo(action);
        await expect(action).toBeFocused();
        await confined();
        console.log(
          `ISOLATED ${mode}, ${tab}: native ancestry + rejected focus for ${background.length} controls; coordinate probes: ${clicked.join(', ')}`,
        );
      }
      async function released(background) {
        await expect(dialog).toHaveCount(0);
        await expect(settings).toBeFocused();
        for (const { label, handle } of background) {
          expect(
            await handle.evaluate(nativeInert),
            `${label}: inert removed on close`,
          ).toBe(false);
          expect(
            await handle.evaluate((el) => {
              el.focus({ preventScroll: true });
              return document.activeElement === el;
            }),
            `${label}: native focus restored after close`,
          ).toBe(true);
        }
      }

      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      await activate(settings);
      const fixture = {
        ...(await exported()),
        coins: 12345.25,
        gems: 37,
        pendingOffline: 0,
      };
      // Distinct positive unmanaged registers detect accidental collection;
      // no manager transfer or elapsed earnings can mask exact equality.
      Object.assign(fixture.restaurants.noodle_nook, {
        owned: true,
        level: 1,
        hasManager: false,
        register: 7.25,
      });
      Object.assign(fixture.restaurants.coffee_corner, {
        owned: true,
        level: 1,
        hasManager: false,
        register: 11.5,
      });
      await restore(fixture);
      await activate(button('Back to the neighborhood'));
      console.log(
        `FIXTURE ${mode}: valid supported import and exact full export; fixed-time Canvas, not fresh WebGL progression`,
      );

      for (const tab of ['Street', 'Kitchen']) {
        await activate(button(tab));
        await frames();
        const restaurant =
          tab === 'Street'
            ? plot('coffee_corner')
            : button('Visit restaurant ↗').nth(1);
        await activate(
          tab === 'Street'
            ? plot('noodle_nook')
            : button('Visit restaurant ↗').first(),
        );
        await expect(panel.locator('h2')).toBeFocused();
        await expect(panel.locator('h2')).toContainText('Noodle Nook');
        const background = await targets(restaurant);
        await activate(settings);
        const raw = '  unfinished import draft\n{"coins": 42';
        await draft.fill(raw);
        await isolated(background, tab, 'Noodle Nook');
        await expect(draft).toHaveValue(raw);
        expect(
          await exported(),
          'Background pointer/focus attempts cannot earn or mutate any save field',
        ).toEqual(fixture);
        await activate(button('Reset my street'));
        await expect(button('Keep my street')).toBeFocused();
        await tabTo(draft);
        await draft.fill(`${raw} edited`);
        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
        await expect(button('Yes, start fresh')).toHaveCount(0);
        await expect(button('Reset my street')).toBeFocused();
        await expect(draft).toHaveValue(`${raw} edited`);
        await isolated(background, tab, 'Noodle Nook');
        expect(await exported()).toEqual(fixture);
        await page.keyboard.press('Escape');
        await released(background);
        await expect(panel.locator('h2')).toContainText('Noodle Nook');
        // A second open/explicit close exercises teardown and reapplication.
        await activate(settings);
        await expect(dialog).toBeVisible();
        await isolated(background, tab, 'Noodle Nook');
        await activate(button('Back to the neighborhood'));
        await released(background);
        await activate(button('Close restaurant'));
        await fullSave(fixture);
      }
      await page.reload();
      await frames();
      await fullSave(fixture);

      // Supported pending import clears selection by existing save semantics.
      // Capture handles AFTER import and before closing Settings into Welcome.
      await activate(settings);
      const pending = { ...structuredClone(fixture), pendingOffline: 432.125 };
      await restore(pending);
      // Existing controls are inert here, so obtain DOM handles without role
      // queries that intentionally exclude the inaccessible background.
      const welcomeBackground = [];
      for (const [label, selector] of [
        ['background navigation', '.topbar button[aria-label="Upgrades"]'],
        ['background Settings opener', '.topbar button[aria-label="Settings"]'],
        ['background restaurant selection', '#restaurant-plot-coffee_corner'],
        [
          'background register collection',
          'button[aria-label="Collect from Noodle Nook"]',
        ],
      ]) {
        const handle = await page.locator(selector).elementHandle();
        expect(handle, label).not.toBeNull();
        welcomeBackground.push({ label, handle });
      }
      await activate(button('Back to the neighborhood'));
      await expect(dialog).toHaveAttribute(
        'aria-label',
        'Welcome back, neighbor!',
      );
      await expect(button('Collect earnings')).toBeFocused();
      // Unlike Settings, the welcome dialog's first action claims the reward:
      // isolation checks below must not activate that action prematurely.
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await isolated(welcomeBackground, 'Street', null);
      expect(
        await page.evaluate(() =>
          JSON.parse(localStorage.getItem('restaurant-streets-save')),
        ),
        'Welcome background probes preserve the exact imported pending save',
      ).toEqual(pending);
      await activate(button('Collect earnings'));
      const claimed = {
        ...structuredClone(fixture),
        coins: fixture.coins + pending.pendingOffline,
      };
      await expect(button('Collect earnings')).toHaveCount(0);
      await released(welcomeBackground);
      await fullSave(claimed);
      for (let round = 0; round < 2; round++) {
        await page.reload();
        await frames();
        await expect(button('Collect earnings')).toHaveCount(0);
        await fullSave(claimed);
      }
      expect(errors).toEqual([]);
      console.log(
        `PASS ${mode}: Settings Street/Kitchen + selected panel/draft; local reset Escape; close and native background focus restoration; pending welcome isolation/single claim; exact full saves and repeated reload. Canvas fixture only; zero page errors.`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
