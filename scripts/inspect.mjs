import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => console.log('ERROR', e.message));
await page.goto('http://localhost:5173/?qa=1');
await page.waitForTimeout(5000);
await page.screenshot({ path: 'test-results/desktop.png' });
console.log(await page.locator('body').innerText());
await browser.close();
