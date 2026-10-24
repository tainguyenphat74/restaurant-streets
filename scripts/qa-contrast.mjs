import { chromium, expect } from '@playwright/test';

const base = process.env.QA_URL;
if (!base)
  throw new Error('Set QA_URL to public production or a stable preview');
// Real DOM, supported save UI, fixed-Date Canvas fixture. No gameplay actions,
// injected nodes/styles, writable QA hooks, or source-based contrast checks.
// Deliberately bounded to solid-backed text; canvas/translucent map copy is not
// inferred from an ancestor color. Unsupported paints fail, never count as RED.
const failures = [];
const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-webgl'],
});
try {
  for (const mobile of [false, true]) {
    const mode = mobile ? 'mobile' : 'desktop';
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
      const button = (name) => page.getByRole('button', { name, exact: true });
      const activate = async (target) =>
        mobile ? target.tap() : target.click();
      const frames = () => page.clock.runFor(1000);
      async function measure(target, label, hover = false) {
        await expect(target).toBeVisible();
        await target.evaluate((el) =>
          el.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: 'instant',
          }),
        );
        await page.mouse.move(0, 0);
        if (hover) await target.hover();
        const result = await target.evaluate((el) => {
          if (el.closest(':disabled,[aria-disabled="true"],[inert]'))
            throw new Error('Disabled/inert sample');
          const parse = (value) => {
            const match = value.match(/^rgba?\(([^)]+)\)$/);
            if (!match) throw new Error(`Unsupported color: ${value}`);
            const parts = match[1].split(',').map(Number);
            if (parts.length === 3) parts.push(1);
            if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)))
              throw new Error(`Unsupported color: ${value}`);
            return parts;
          };
          let background;
          for (let node = el; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (
              Number(style.opacity) !== 1 ||
              style.filter !== 'none' ||
              style.mixBlendMode !== 'normal' ||
              style.maskImage !== 'none'
            )
              throw new Error('Unsupported compositing');
            if (!background) {
              if (
                style.backgroundImage !== 'none' ||
                style.backdropFilter !== 'none'
              )
                throw new Error('Unsupported background paint');
              for (const pseudo of ['::before', '::after']) {
                const paint = getComputedStyle(node, pseudo);
                if (!['none', 'normal'].includes(paint.content))
                  throw new Error('Unsupported generated background/content');
              }
              const color = parse(style.backgroundColor);
              if (color[3] !== 0 && color[3] !== 1)
                throw new Error('Unsupported translucent background');
              if (color[3] === 1) background = color;
            }
          }
          if (!background) throw new Error('No opaque background');
          const style = getComputedStyle(el);
          const foreground = parse(style.color);
          if (
            foreground[3] !== 1 ||
            style.textShadow !== 'none' ||
            style.webkitTextFillColor !== style.color
          )
            throw new Error('Unsupported foreground paint');
          // Require actual visible text, not merely a visible container.
          const text = [...el.childNodes].find(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              /[\p{L}\p{N}]/u.test(node.textContent),
          );
          if (!text) throw new Error('Sample needs direct normal text');
          const range = document.createRange();
          range.selectNodeContents(text);
          const visible = [...range.getClientRects()].some((r) => {
            const x = (r.left + r.right) / 2,
              y = (r.top + r.bottom) / 2;
            return (
              x > 0 &&
              x < innerWidth &&
              y > 0 &&
              y < innerHeight &&
              el.contains(document.elementFromPoint(x, y))
            );
          });
          if (!visible) throw new Error('Text is clipped or occluded');
          const luminance = (color) =>
            color
              .slice(0, 3)
              .map((v) => {
                v /= 255;
                return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          const a = luminance(foreground),
            b = luminance(background);
          return {
            foreground,
            background,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
        console.log(
          `${mode} ${label}: ${result.ratio.toFixed(3)}:1 fg=${result.foreground.slice(0, 3)} bg=${result.background.slice(0, 3)}`,
        );
        if (result.ratio < 4.5)
          failures.push(
            `${mode} ${label}: ${result.ratio.toFixed(3)}:1 < 4.5:1`,
          );
      }
      async function exported() {
        await activate(button('Copy / download save'));
        await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
          'Save copied to clipboard.',
        );
        return JSON.parse(
          await page.evaluate(() => navigator.clipboard.readText()),
        );
      }
      await page.clock.install({ time: 1800000000000 });
      await page.clock.pauseAt(1800000000000);
      await page.goto(`${base}/?qa=1`);
      await frames();
      await page.clock.setFixedTime(await page.evaluate(() => Date.now()));
      await activate(button('Settings'));
      const fixture = {
        ...(await exported()),
        coins: 1000000000,
        gems: 37,
        pendingOffline: 0,
      };
      await page
        .getByLabel('Import a saved street')
        .fill(JSON.stringify(fixture));
      await activate(button('Restore save'));
      await expect(page.getByRole('dialog').getByRole('status')).toHaveText(
        'Street restored.',
      );
      expect(await exported()).toEqual(fixture);
      await activate(button('Back to the neighborhood'));
      for (const tab of ['Street', 'Kitchen', 'Upgrades']) {
        await activate(button(tab));
        await frames();
        await expect(button(tab)).toHaveAttribute('aria-current', 'page');
        for (const name of ['Street', 'Kitchen', 'Upgrades', 'Rankings'])
          await measure(button(name), `${tab} nav ${name}`);
        if (tab === 'Street') {
          await measure(
            page.locator('.street-switch button[aria-pressed="true"]'),
            'Street selected street',
          );
          await activate(page.locator('#restaurant-plot-noodle_nook'));
          await frames();
          await measure(
            page.locator('.restaurant-panel p').first(),
            'Street muted restaurant copy',
          );
          await activate(button('Close restaurant'));
        } else {
          await measure(page.locator('.page > p'), `${tab} muted introduction`);
          await measure(page.locator('.page > .eyebrow'), `${tab} eyebrow`);
          if (tab === 'Kitchen') {
            await measure(
              page
                .locator('[aria-labelledby="progression-help-title"] p')
                .first(),
              'Kitchen muted card copy',
            );
            await measure(
              button('Open upgrades and boosts'),
              'Kitchen coral action',
            );
            await measure(
              page.locator('.mastery-list .button:not(:disabled)').first(),
              'Kitchen secondary action',
            );
          } else {
            await measure(
              page.locator('.card-grid .card p').first(),
              'Upgrades muted card copy',
            );
            await measure(
              page.locator('.card-grid .button:not(:disabled)').first(),
              'Upgrades coral action',
            );
            await measure(
              page.locator('.boost-card p'),
              'Upgrades muted cream copy',
            );
            await measure(
              button('Start rush hour · 💎 10'),
              'Upgrades boost action',
            );
          }
        }
      }
      await activate(button('Settings'));
      const dialog = page.getByRole('dialog');
      await measure(dialog.locator('p').first(), 'Settings muted copy');
      await measure(dialog.locator('.fine-print'), 'Settings fine print');
      await measure(button('Copy / download save'), 'Settings coral export');
      await measure(button('Reset my street'), 'Settings coral text');
      await measure(
        button('Back to the neighborhood'),
        'Settings secondary action',
      );
      if (!mobile) {
        await measure(
          button('Copy / download save'),
          'Settings coral export hover',
          true,
        );
        await measure(
          button('Back to the neighborhood'),
          'Settings secondary hover',
          true,
        );
      }
      expect(await exported()).toEqual(fixture);
      await activate(button('Back to the neighborhood'));
      await page.reload();
      await frames();
      await activate(button('Settings'));
      expect(await exported()).toEqual(fixture);
      expect(errors, `${mode} page errors`).toEqual([]);
      console.log(
        `PASS ${mode}: real navigation, exact supported export/reload, zero page errors (Canvas fixture)`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
expect(
  failures,
  'Normal text contrast failures (unrounded threshold 4.5:1)',
).toEqual([]);
console.log(
  'PASS normal text contrast >=4.5:1 for every representative sample',
);
