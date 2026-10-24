import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to public production or a stable preview');
// The current parseSave/migrateSave has no length bound. This UI-only contract
// uses 1 MiB: ample for every supported strict-schema save, without changing it.
const maxFileBytes = 1024 * 1024;
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
// Imported Canvas fixtures only; qa.mjs retains natural WebGL gameplay coverage.
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
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      // Browser API fault injection, never a game/store mutation hook. Support
      // either native Blob.text or FileReader.readAsText implementations.
      await page.addInitScript(() => {
        const pending = new Map();
        window.fileReadQA = {
          pending: (name) => pending.has(name),
          settle(name, reject = false) {
            const finish = pending.get(name);
            if (!finish) throw new Error(`No pending read: ${name}`);
            pending.delete(name);
            finish(reject);
          },
        };
        const text = Blob.prototype.text;
        Blob.prototype.text = function () {
          if (!this.name?.startsWith('deferred-')) return text.call(this);
          return new Promise((resolve, reject) => {
            pending.set(this.name, (fail) => {
              if (fail)
                reject(
                  new DOMException('Test read failure', 'NotReadableError'),
                );
              else text.call(this).then(resolve, reject);
            });
          });
        };
        const read = FileReader.prototype.readAsText;
        FileReader.prototype.readAsText = function (file, encoding) {
          if (!file.name?.startsWith('deferred-'))
            return read.call(this, file, encoding);
          pending.set(file.name, (fail) => {
            if (!fail) return read.call(this, file, encoding);
            Object.defineProperty(this, 'error', {
              configurable: true,
              value: new DOMException('Test read failure', 'NotReadableError'),
            });
            this.dispatchEvent(new ProgressEvent('error'));
            this.dispatchEvent(new ProgressEvent('loadend'));
          });
        };
      });
      const button = (name) => page.getByRole('button', { name, exact: true });
      const ui = (target) => (mobile ? target.tap() : target.click());
      const dialog = page.getByRole('dialog');
      const draft = page.getByLabel('Import a saved street', { exact: true });
      const input = dialog.locator('input[type="file"]');
      const status = dialog.getByRole('status');
      const stored = () =>
        page.evaluate(() => localStorage.getItem('restaurant-streets-save'));
      async function exported() {
        await ui(button('Copy / download save'));
        await expect(status).toHaveText('Save copied to clipboard.');
        return JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
      }
      async function choose(name, raw) {
        await input.setInputFiles({
          name,
          mimeType: 'application/json',
          buffer: Buffer.from(raw),
        });
      }
      async function settle(name, reject = false) {
        await expect
          .poll(() => page.evaluate((n) => window.fileReadQA.pending(n), name))
          .toBe(true);
        await page.evaluate(
          ({ name, reject }) => window.fileReadQA.settle(name, reject),
          { name, reject },
        );
        // Independent animation frames settle React/file API tasks; Date.now stays fixed.
        await page.clock.runFor(100);
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
      // Produce the backup through supported paste/restore/export, then return
      // to a different street so accidental restore on file selection is visible.
      await draft.fill(JSON.stringify(fixture));
      await ui(button('Restore save'));
      await expect(status).toHaveText('Street restored.');
      expect(await exported()).toEqual(fixture);
      const backup = await page.evaluate(() => navigator.clipboard.readText());
      await draft.fill(JSON.stringify(initial));
      await ui(button('Restore save'));
      await expect(status).toHaveText('Street restored.');
      expect(await exported()).toEqual(initial);
      const rawBefore = await stored();
      async function unchanged() {
        await expect(dialog).toBeVisible();
        expect(await stored()).toBe(rawBefore);
        expect(await exported()).toEqual(initial);
      }
      // First expected baseline RED: existing Settings has no native file input.
      await expect(
        input,
        'Settings exposes one native backup file control',
      ).toHaveCount(1);
      await expect(input).toBeVisible();
      await expect(input).toHaveAccessibleName(/backup|save|json/i);
      expect(
        (await input.getAttribute('accept')).split(',').map((s) => s.trim()),
      ).toEqual(expect.arrayContaining(['.json', 'application/json']));
      for (let i = 0; i < 30; i++) {
        if (await input.evaluate((el) => el === document.activeElement)) break;
        await page.keyboard.press('Tab');
      }
      await expect(input).toBeFocused();
      expect(await page.locator('#root').evaluate((el) => el.inert)).toBe(true);
      const chooserPromise = page.waitForEvent('filechooser');
      if (mobile) await ui(input);
      else await page.keyboard.press('Enter');
      const chooser = await chooserPromise;
      await chooser.setFiles({
        name: 'restaurant-streets.json',
        mimeType: 'application/json',
        buffer: Buffer.from(backup),
      });
      await expect(draft).toHaveValue(backup);
      await expect(status).toContainText(/loaded.*draft.*review.*Restore/i);
      await expect(input).toHaveValue('');
      const bounds = await input.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThan(100);
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await input.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/file-import-${width}x${height}-imported-Canvas-fixture.png`,
      });
      await unchanged();
      // Boundary reads do not bypass the existing explicit Restore validation.
      await choose('empty.json', '');
      await expect(draft).toHaveValue('');
      await expect(button('Restore save')).toBeDisabled();
      await unchanged();
      const atLimit =
        backup + ' '.repeat(maxFileBytes - Buffer.byteLength(backup));
      await choose('at-limit.json', atLimit);
      await expect(draft).toHaveValue(atLimit);
      await unchanged();
      await draft.fill('manual edit between identical selections');
      await choose('restaurant-streets.json', backup);
      await expect(draft).toHaveValue(backup);
      await unchanged();
      await ui(button('Reset my street'));
      await expect(button('Keep my street')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(button('Reset my street')).toBeFocused();
      await expect(draft).toHaveValue(backup);
      await choose('invalid.json', '{ invalid JSON');
      await expect(draft).toHaveValue('{ invalid JSON');
      await unchanged();
      await ui(button('Restore save'));
      await expect(status).toContainText('Invalid or unsupported save');
      await unchanged();
      await draft.fill('retained draft');
      await choose('oversized.json', ' '.repeat(maxFileBytes + 1));
      await expect(status).toContainText(/too large|size|limit|exceed/i);
      await expect(draft).toHaveValue('retained draft');
      await unchanged();
      await choose('deferred-unreadable.json', backup);
      await settle('deferred-unreadable.json', true);
      await expect(status).toContainText(
        /unable|could not|couldn.t|failed|cannot|can.t/i,
      );
      await expect(draft).toHaveValue('retained draft');
      await unchanged();
      for (const reject of [false, true]) {
        for (const action of ['cancel', 'oversize', 'restore', 'reset']) {
          await draft.fill('retained draft');
          await choose('deferred-action.json', backup);
          if (action === 'cancel') await input.dispatchEvent('cancel');
          if (action === 'oversize')
            await choose('oversized.json', ' '.repeat(maxFileBytes + 1));
          if (action === 'restore') await ui(button('Restore save'));
          if (action === 'reset') {
            await ui(button('Reset my street'));
            await ui(button('Keep my street'));
          }
          const actionMessage = await status.textContent();
          await settle('deferred-action.json', reject);
          await expect(draft).toHaveValue('retained draft');
          await expect(status).toHaveText(actionMessage);
          await unchanged();
        }
        await choose('deferred-edit.json', backup);
        await expect
          .poll(() =>
            page.evaluate(() =>
              window.fileReadQA.pending('deferred-edit.json'),
            ),
          )
          .toBe(true);
        await draft.fill('newer manual draft');
        const message = await status.textContent();
        await settle('deferred-edit.json', reject);
        await expect(draft).toHaveValue('newer manual draft');
        await expect(status).toHaveText(message);
        await unchanged();
        await choose('deferred-first.json', backup);
        await choose('later.json', JSON.stringify(initial, null, 2));
        await expect(draft).toHaveValue(JSON.stringify(initial, null, 2));
        const laterMessage = await status.textContent();
        await settle('deferred-first.json', reject);
        await expect(draft).toHaveValue(JSON.stringify(initial, null, 2));
        await expect(status).toHaveText(laterMessage);
        await unchanged();
        await choose('deferred-unmount.json', backup);
        await ui(button('Back to the neighborhood'));
        await expect(button('Settings')).toBeFocused();
        await ui(button('Settings'));
        await expect(draft).toHaveValue('');
        await draft.fill('remounted draft');
        const remountedMessage = await status.textContent();
        await settle('deferred-unmount.json', reject);
        await expect(draft).toHaveValue('remounted draft');
        await expect(status).toHaveText(remountedMessage);
        await unchanged();
      }
      await choose('restaurant-streets.json', backup);
      await expect(draft).toHaveValue(backup);
      await unchanged();
      await ui(button('Restore save'));
      await expect(status).toHaveText('Street restored.');
      await expect(draft).toHaveValue('');
      expect(await exported()).toEqual(fixture);
      await ui(button('Back to the neighborhood'));
      await page.reload();
      await page.clock.runFor(100);
      await expect(button('Collect earnings')).toBeVisible();
      await ui(button('Collect earnings'));
      await expect(button('Collect earnings')).toHaveCount(0);
      await ui(button('Settings'));
      const claimed = {
        ...fixture,
        coins: fixture.coins + fixture.pendingOffline,
        pendingOffline: 0,
      };
      expect(await exported()).toEqual(claimed);
      await page.reload();
      await page.clock.runFor(100);
      await expect(button('Collect earnings')).toHaveCount(0);
      await ui(button('Settings'));
      expect(await exported()).toEqual(claimed);
      // Protected raw bytes remain protected after merely loading a valid file.
      await page.goto(`${base}/favicon.ico`);
      const protectedRaw = '{ broken original save';
      await page.evaluate(
        (raw) => localStorage.setItem('restaurant-streets-save', raw),
        protectedRaw,
      );
      await page.goto(`${base}/?qa=1`);
      await page.clock.runFor(100);
      await ui(button('Settings'));
      await choose('restaurant-streets.json', backup);
      await expect(draft).toHaveValue(backup);
      await page.clock.runFor(11000);
      expect(await stored()).toBe(protectedRaw);
      await ui(button('Copy / download save'));
      await expect(status).toContainText('Export paused:');
      await expect(dialog).toContainText('Original raw save remains untouched');
      expect(errors).toEqual([]);
      console.log(
        `PASS ${mobile ? 'mobile' : 'desktop'} ${width}x${height} file draft/exact export, explicit restore, empty/1MiB/invalid/oversized/unreadable, stale resolve/reject, same file, modal/reset, protected bytes, all fields and single pending claim/reload; Canvas fixtures`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
