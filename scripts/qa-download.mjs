import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to public production or a stable preview');
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
// Imported Canvas fixtures, not natural gameplay or physical-device evidence.
try {
  for (const [mobile, width, height] of [
    [false, 1440, 900],
    [true, 390, 844],
    [true, 320, 568],
    [true, 667, 320],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: 'reduce',
      acceptDownloads: true,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      const errors = [],
        downloads = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('download', (event) => downloads.push(event));
      // Observe real browser APIs; never replace the game store/export validator.
      await page.addInitScript(() => {
        const clipboard = navigator.clipboard;
        const write = clipboard.writeText.bind(clipboard);
        const create = URL.createObjectURL.bind(URL);
        const revoke = URL.revokeObjectURL.bind(URL);
        const qa = (window.downloadQA = {
          calls: 0,
          created: [],
          revoked: [],
          mode: 'success',
        });
        clipboard.writeText = (...args) => {
          qa.calls++;
          if (qa.mode === 'reject')
            return Promise.reject(
              new DOMException('QA denied', 'NotAllowedError'),
            );
          return write(...args);
        };
        qa.clipboardMode = (mode) => {
          qa.mode = mode;
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: mode === 'unavailable' ? undefined : clipboard,
          });
        };
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
          if (
            qa.failure === 'click' &&
            this.download === 'restaurant-streets.json'
          )
            throw new DOMException('QA click failure', 'NotSupportedError');
          return click.call(this);
        };
        URL.createObjectURL = (blob) => {
          if (qa.failure === 'create')
            throw new DOMException('QA URL failure', 'NotSupportedError');
          const url = create(blob);
          qa.created.push({ url, type: blob.type });
          return url;
        };
        URL.revokeObjectURL = (url) => {
          qa.revoked.push(url);
          return revoke(url);
        };
      });
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const dialog = page.getByRole('dialog');
      const status = dialog.getByRole('status');
      const draft = page.getByLabel('Import a saved street', { exact: true });
      const downloadButton = button('Download backup');
      const stored = () =>
        page.evaluate(() => localStorage.getItem('restaurant-streets-save'));
      const observed = () =>
        page.evaluate(() => ({
          calls: window.downloadQA.calls,
          created: window.downloadQA.created,
          revoked: window.downloadQA.revoked,
        }));
      const mode = (value) =>
        page.evaluate((v) => window.downloadQA.clipboardMode(v), value);
      async function exported() {
        await mode('success');
        const before = downloads.length;
        await ui(button('Copy / download save'));
        await expect(status).toHaveText('Save copied to clipboard.');
        expect(downloads.length).toBe(before);
        return JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
      }
      async function restore(value) {
        await draft.fill(JSON.stringify(value));
        await ui(button('Restore save'));
        await expect(status).toHaveText('Street restored.');
      }
      async function geometry() {
        // Let the actual scroll container expose the control before measuring.
        await downloadButton.scrollIntoViewIfNeeded();
        const rect = await downloadButton.boundingBox();
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height);
        expect(
          await downloadButton.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [
              [0.1, 0.1],
              [0.9, 0.1],
              [0.5, 0.5],
              [0.1, 0.9],
              [0.9, 0.9],
            ].every(([x, y]) =>
              el.contains(
                document.elementFromPoint(
                  r.x + r.width * x,
                  r.y + r.height * y,
                ),
              ),
            );
          }),
        ).toBe(true);
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        return rect;
      }
      async function explicitActivation(key) {
        await expect(downloadButton).toBeEnabled();
        const rect = await geometry();
        if (mobile)
          await page.touchscreen.tap(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
        else {
          for (let i = 0; i < 40; i++) {
            if (
              await downloadButton.evaluate(
                (el) => el === document.activeElement,
              )
            )
              break;
            await page.keyboard.press('Tab');
          }
          await expect(downloadButton).toBeFocused();
          await page.keyboard.press(key);
        }
      }
      async function downloaded(expected, activate, clipboardDelta = 0) {
        const before = await observed();
        const count = downloads.length;
        const eventPromise = page.waitForEvent('download');
        await activate();
        const event = await eventPromise;
        expect(event.suggestedFilename()).toBe('restaurant-streets.json');
        expect(await event.failure()).toBeNull();
        // Read every actual downloaded byte, not the source Blob or an anchor href.
        const bytes = await readFile(await event.path());
        expect(JSON.parse(bytes.toString('utf8'))).toEqual(expected);
        await expect(status).toHaveText('Save downloaded.');
        const after = await observed();
        expect(after.calls - before.calls).toBe(clipboardDelta);
        expect(after.created.length - before.created.length).toBe(1);
        const created = after.created.at(-1);
        expect(created.type).toBe('application/json');
        expect(event.url()).toBe(created.url);
        expect(before.created.map((v) => v.url)).not.toContain(created.url);
        // Bounded eventual cleanup, no requirement for an exact timer delay.
        for (let i = 0; i < 100; i++) {
          if ((await observed()).revoked.includes(created.url)) break;
          await page.clock.runFor(100);
        }
        expect(
          (await observed()).revoked.filter((url) => url === created.url),
        ).toHaveLength(1);
        expect(downloads.length).toBe(count + 1);
        return bytes;
      }
      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await page.clock.runFor(1000);
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      await ui(button('Settings'));
      const initial = await exported();
      const fixture = structuredClone(initial);
      Object.assign(fixture, {
        coins: 12345.25,
        gems: 99,
        boostUntil: initial.savedAt + 200000,
        upgrades: ['ingredients', 'service'],
        pendingOffline: 432.125,
      });
      fixture.neighborhood = {
        currentStreet: 'riverside_market',
        unlockedStreets: ['maple_street', 'riverside_market'],
      };
      Object.values(fixture.restaurants).forEach((r, i) =>
        Object.assign(r, {
          owned: true,
          level: [25, 50, 100, 1000, 37, 61, 7, 29][i],
          hasManager: i % 2 === 0,
          register: i % 2 === 0 ? 0 : i + 0.125,
        }),
      );
      await restore(fixture);
      const expected = await exported();
      expect(expected).toEqual(fixture);
      const rawBefore = await stored();
      // First behavioral RED on baseline: a separate explicit action is absent.
      await expect(
        downloadButton,
        'Settings exposes a separate Download backup button',
      ).toHaveCount(1);
      await expect(button('Copy / download save')).toHaveCount(1);
      let bytes;
      for (const [clipboardMode, key] of [
        ['success', 'Enter'],
        ['unavailable', 'Space'],
        ['reject', 'Enter'],
      ]) {
        await mode(clipboardMode);
        bytes = await downloaded(expected, () => explicitActivation(key));
        expect(await stored()).toBe(rawBefore);
      }
      await geometry();
      await page.screenshot({
        path: `test-results/download-${width}x${height}-imported-Canvas-fixture.png`,
      });
      // Existing copy success and denied/unavailable fallback stay functional.
      expect(await exported()).toEqual(expected);
      for (const clipboardMode of ['reject', 'unavailable']) {
        await mode(clipboardMode);
        await downloaded(
          expected,
          () => ui(button('Copy / download save')),
          clipboardMode === 'reject' ? 1 : 0,
        );
      }
      expect(await stored()).toBe(rawBefore);
      // Inject only browser download setup failures: no fake download payloads.
      for (const failure of ['create', 'click']) {
        const before = await observed();
        const count = downloads.length;
        await page.evaluate((value) => {
          window.downloadQA.failure = value;
        }, failure);
        await explicitActivation('Enter');
        await expect(status).toHaveText(
          'Could not start the backup download. Please try again.',
        );
        await page.clock.runFor(1500);
        const after = await observed();
        expect(downloads.length).toBe(count);
        expect(after.calls).toBe(before.calls);
        expect(after.created.length - before.created.length).toBe(
          failure === 'click' ? 1 : 0,
        );
        if (failure === 'click') {
          const url = after.created.at(-1).url;
          expect(after.revoked.filter((value) => value === url)).toHaveLength(
            1,
          );
        }
        expect(await stored()).toBe(rawBefore);
      }
      await page.evaluate(() => {
        window.downloadQA.failure = undefined;
      });
      await mode('success');
      await restore(initial);
      const initialRaw = await stored();
      await dialog.locator('input[type="file"]').setInputFiles({
        name: 'restaurant-streets.json',
        mimeType: 'application/json',
        buffer: bytes,
      });
      await expect(draft).toHaveValue(bytes.toString('utf8'));
      expect(await stored()).toBe(initialRaw);
      expect(await exported()).toEqual(initial);
      await ui(button('Restore save'));
      await expect(status).toHaveText('Street restored.');
      expect(await exported()).toEqual(expected);
      await ui(button('Back to the neighborhood'));
      await page.reload();
      await page.clock.runFor(100);
      await expect(button('Collect earnings')).toBeVisible();
      await ui(button('Collect earnings'));
      await expect(button('Collect earnings')).toHaveCount(0);
      await ui(button('Settings'));
      const claimed = {
        ...expected,
        coins: expected.coins + expected.pendingOffline,
        pendingOffline: 0,
      };
      expect(await exported()).toEqual(claimed);
      await page.reload();
      await page.clock.runFor(100);
      await expect(button('Collect earnings')).toHaveCount(0);
      await ui(button('Settings'));
      expect(await exported()).toEqual(claimed);
      // Boot through normal protected-save recovery, preserving literal bytes.
      await page.goto(`${base}/favicon.ico`);
      const protectedRaw = '{ broken original save  ';
      await page.evaluate(
        (raw) => localStorage.setItem('restaurant-streets-save', raw),
        protectedRaw,
      );
      await page.goto(`${base}/?qa=1`);
      await page.clock.runFor(100);
      await ui(button('Settings'));
      const before = await observed(),
        count = downloads.length;
      await explicitActivation('Enter');
      await expect(status).toContainText('Export paused:');
      await expect(status).toContainText('Original raw save remains untouched');
      await expect(status).not.toHaveText('Save downloaded.');
      await page.clock.runFor(11000);
      expect(await observed()).toEqual(before);
      expect(downloads.length).toBe(count);
      expect(await stored()).toBe(protectedRaw);
      expect(errors).toEqual([]);
      console.log(
        `PASS ${width}x${height}: explicit/repeated download bytes/MIME/name, clipboard independence and fallback, URL cleanup, native keyboard/tap geometry, file draft/restore/single claim/reload, protected bytes; Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
