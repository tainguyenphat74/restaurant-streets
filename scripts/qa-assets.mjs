import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const base = process.env.QA_URL || 'http://localhost:5173';
try {
  const page = await browser.newPage();
  const errors = [];
  const failed = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(r.url());
  });
  await page.goto(base + '/?qa=1');
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  expect(failed).toEqual([]);
  let manifest = {
    building_noodle_nook: {
      file: 'qa-fixture.png',
      anchorX: 0.25,
      anchorY: 0.75,
      scale: 0.8,
    },
    building_coffee_corner: {
      file: 'qa-missing.png',
      anchorX: 0.1,
      anchorY: 0.2,
      scale: 3,
    },
  };
  await page.route('**/assets/manifest.json', (route) =>
    route.fulfill({ json: manifest }),
  );
  await page.route('**/assets/qa-fixture.png', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==',
        'base64',
      ),
    }),
  );
  await page.route('**/assets/qa-missing.png', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.reload();
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  await page.getByRole('button', { name: /Noodle Nook Lv/ }).click();
  const preview = page.locator('.preview img');
  await expect(preview).toBeVisible();
  expect(await preview.evaluate((e) => e.naturalWidth)).toBe(1);
  expect(await preview.getAttribute('style')).toContain(
    'transform-origin: 25% 75%',
  );
  expect(await preview.getAttribute('style')).toContain('scale(0.8)');
  await page.getByRole('button', { name: 'Close restaurant' }).click();
  await page
    .getByRole('button', { name: /For Sale.*100/, exact: false })
    .first()
    .click();
  expect(await preview.evaluate((e) => e.naturalWidth)).toBe(200);
  expect(await preview.getAttribute('style')).toContain(
    'transform-origin: 50% 100%',
  );
  expect(await preview.getAttribute('style')).toContain('scale(1)');
  await page.getByRole('button', { name: 'Close restaurant' }).click();
  manifest = {};
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Kitchen', exact: true })
    .click();
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Street', exact: true })
    .click();
  await page.waitForFunction(() => window.restaurantQA?.().scene.ready);
  await page.getByRole('button', { name: /Noodle Nook Lv/ }).click();
  expect(await preview.evaluate((e) => e.naturalWidth)).toBe(200);
  expect(await preview.getAttribute('style')).toContain(
    'transform-origin: 50% 100%',
  );
  expect(await preview.getAttribute('style')).toContain('scale(1)');
  expect(failed).toEqual([base + '/assets/qa-missing.png']);
  expect(errors).toEqual([]);
  console.log(
    'PASS: default assets have no failed requests; temporary PNG preview, custom anchor/scale, missing fallback, empty-manifest metadata reset.',
  );
} finally {
  await browser.close();
}
