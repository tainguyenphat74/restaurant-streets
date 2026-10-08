# Restaurant Streets

A cozy, single-player idle restaurant street built with React 18, strict TypeScript, Vite, Phaser 3, Zustand, Tailwind CSS 4 and Vitest. No backend or multiplayer; progress belongs to this browser's localStorage.

## Setup

Use Node.js 22.12+ (or a supported newer LTS).

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm run dev` serves the game at http://localhost:5173. `npm run build` produces a static `dist/` directory. This repository does not deploy automatically.

For browser QA, keep the dev server running, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. `node scripts/qa-lifecycle.mjs` adds reduced-motion, scene teardown, invalid-import and blocked-storage checks. Set `QA_URL=http://127.0.0.1:4173` to check a production preview instead. Screenshots and other output go to ignored `test-results/`. The script earns its first upgrade in real time, then uses the normal import UI for advanced-state tests; screenshots only show fresh or naturally earned progress.

## Playing

Collect the gold bubble above Noodle Nook, then select the restaurant to upgrade. Buy the vacant For Sale plots as your street grows. Kitchen lets you hire managers for automatic collection and half-rate offline earnings (up to eight hours). Upgrades offers permanent street multipliers and a ten-minute gem boost. Rankings compares your net worth with nine fictional, deterministic competitors.

Drag the map to pan; use the wheel, two-finger pinch, or +/− buttons to zoom. The target button recenters. Tap a building or its React label to open its panel; close it with × or Escape. On phones the panel becomes a scrolling bottom sheet below navigation. Settings supports validated import, export with download fallback, and confirmed reset. Back up your save before clearing browser data. If browser storage is blocked, a banner appears; use export to preserve progress.

The game honors reduced motion, supports keyboard buttons and focus-trapped dialogs, and pauses active earnings while hidden. Only managed restaurants earn offline rewards. Registers hold sixty seconds of current income. Offline claims are checkpointed in the save to avoid duplicate rewards on refresh; blocked storage cannot guarantee persistence across reloads.

See [BUILD_SPEC.md](BUILD_SPEC.md) for the implementation contract, architecture, tuning, and asset replacement guide.
