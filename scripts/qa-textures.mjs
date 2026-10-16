import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base) throw new Error('Set QA_URL to a stable production build');
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-webgl'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Observe real generated canvases only; do not alter their pixels or game state.
  await page.addInitScript(() => {
    window.observedTileCanvases = new Set();
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      window.observedTileCanvases.add(this);
      return original.apply(this, args);
    };
  });
  const ready = () => page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  const checkTiles = async () => {
    const tiles = await page.evaluate(() => [...window.observedTileCanvases]
      .filter(c => c.width === 128 && c.height === 64)
      .map(c => {
        const ctx = c.getContext('2d');
        return { alpha: ctx.getContextAttributes().alpha, corner: [...ctx.getImageData(1, 1, 1, 1).data], center: [...ctx.getImageData(64, 32, 1, 1).data] };
      }));
    expect(tiles).toHaveLength(4);
    for (const tile of tiles) {
      expect(tile.alpha, 'isometric textures must retain alpha after a game remount').toBe(true);
      expect(tile.corner).toEqual([0, 0, 0, 0]);
    }
    expect(tiles.map(t => t.center).sort()).toEqual([
      [183, 220, 160, 255], [191, 198, 200, 255],
      [246, 231, 207, 255], [123, 203, 211, 255],
    ].sort());
  };
  await page.goto(`${base}/?qa=1`);
  await ready();
  await checkTiles();
  const fixture = await page.evaluate(() => window.restaurantQA().data);
  for (const r of Object.values(fixture.restaurants)) Object.assign(r, { owned: true, level: 25, hasManager: false, register: 0 });
  fixture.neighborhood = { currentStreet: 'riverside_market', unlockedStreets: ['maple_street', 'riverside_market'] };
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Import a saved street').fill(JSON.stringify({ ...fixture, version: 4, pendingOffline: 0, savedAt: Date.now() }));
  await page.getByRole('button', { name: 'Restore save' }).click();
  await expect(page.getByText('Street restored.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to the neighborhood' }).click();
  await ready();
  await checkTiles();
  for (const street of ['Maple Street', 'Riverside Market', 'Maple Street', 'Riverside Market']) {
    await page.getByRole('button', { name: street, exact: true }).click();
    await ready();
    await checkTiles();
  }
  expect(errors).toEqual([]);
  console.log('PASS Canvas terrain: all four real textures retain expected colors/transparent corners after fresh startup, supported v4 import and repeated street remounts; zero page errors.');
} finally { await browser.close(); }
