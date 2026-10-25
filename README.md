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

`node scripts/qa-customers.mjs` uses Phaser's Canvas fallback to observe real-time dining and exits on desktop/mobile, checks runtime reduced motion and purchase routing, and captures fresh/naturally progressed screenshots. Its purchase checks use a labeled import-UI fixture. It also loads a manifest walker fixture with non-default anchor/scale and captures it for visual review. Manifest walker sprites retain their presentation metadata; primitive people are the fallback.

## Playing

Collect the gold bubble above Noodle Nook, then select the restaurant to upgrade. Buy the vacant For Sale plots as your street grows. Kitchen lets you hire managers for automatic collection and half-rate offline earnings (up to eight hours). Upgrades offers permanent street multipliers and a ten-minute gem boost. Rankings compares your net worth with nine fictional, deterministic competitors.

Bring all six Maple restaurants to level 25, then explicitly unlock Riverside Market in Kitchen. Use the street buttons on the map to switch between Maple and Riverside. River Grill and Market Gelato have their own plots; both streets earn while you visit either one, and global upgrades and boosts apply to both. Unlocking is free and does not buy either restaurant.

In Kitchen mastery, **Search restaurants** filters restaurant names across both streets, ignoring case and surrounding spaces. It works with **Hide completed restaurants** and **Nearest next badge first**, without changing whole-street badge counts or progress. Each street's **Showing X of Y restaurants** status counts the results under the current search and completion filter, stays visible when collapsed, and updates when you restore a save. **Clear search** restores the list under your other filters. These view options reset when you leave Kitchen or reload.

Drag the map to pan; use the wheel, two-finger pinch, or +/− buttons to zoom. The target button recenters. Tap a building or its React label to open its panel; close it with × or Escape. On phones the panel becomes a scrolling bottom sheet below navigation. In Settings, choose **Download backup** to save `restaurant-streets.json` directly without using the clipboard. **Copy / download save** copies your save to the clipboard, or downloads the same JSON backup if clipboard access is unavailable or denied. Settings also supports validated import and confirmed reset. To restore a downloaded backup on desktop or mobile, choose **Load a JSON backup file** (up to 1 MiB), or paste JSON into the import box. Loading a file only fills the draft: review it, then choose **Restore save** to replace your current street. Invalid backups leave current progress unchanged. Back up your save before clearing browser data. If browser storage is blocked, a banner appears; use export to preserve progress.

The game honors reduced motion, supports keyboard buttons and focus-trapped dialogs, and pauses active earnings while hidden. Only managed restaurants earn offline rewards. Registers hold sixty seconds of current income. Offline claims are checkpointed in the save to avoid duplicate rewards on refresh; blocked storage cannot guarantee persistence across reloads.

The six procedural storefronts have cuisine-specific shape signage, glazed displays, striped canopies and planters. Up to 20 ambient customers use same-side sidewalks, pause at owned shop doors, dine out of view and return to strolling. They do not generate revenue or change gameplay customer counts. Reduced motion freezes this activity, including when changed at runtime.

See [BUILD_SPEC.md](BUILD_SPEC.md) for the implementation contract, architecture, tuning, and asset replacement guide.

## Architecture and tuning

React owns navigation, accessible map labels, panels and dialogs. Phaser owns the isometric canvas, camera, pointer gestures and procedural artwork. `src/game/iso.ts` maps grid coordinates to world pixels; `screenToGrid` reverses that projection after camera transforms have been undone. The scene sends label positions only when its camera changes.

`src/state/store.ts` is the shared Zustand store. UI components select only their displayed state; kitchen cards select stable income and affordability values, and map labels subscribe per restaurant. `src/state/economy.ts` contains pure income, costs, ratings, customers, net worth, rankings and offline calculations. `tick.ts` advances active time, handles visibility, and checkpoints saves. `save.ts` validates versioned localStorage/import data. Import restores saved pending rewards without earning additional elapsed-time rewards; claiming checkpoints the cleared award.

Tune restaurant prices, base income, dishes and colors in `src/data/restaurants.ts`, global upgrades in `src/data/upgrades.ts`, and fictional rivals in `src/data/competitors.ts`. Tune level growth, milestones, manager cost, boost duration and offline limits in `src/state/economy.ts`, then update its tests. Save validation caps levels at 1000, money/registers/pending at `1e100`, gems at one million, and boosts at ten minutes beyond the save timestamp. Parsing does not depend on the current clock, so clock changes do not invalidate backups; future timestamps earn no offline income until time catches up.

## Replacing procedural art with AI artwork

The shipped `public/assets/manifest.json` is `{}`: every texture is generated locally, with no missing-image requests. Generate an isolated sprite using a prompt such as:

> Cozy hand-painted isometric noodle restaurant, warm coral walls, cream awning, tiny plants, soft afternoon light, orthographic 2:1 isometric ground plane, isolated building, no text, no border, transparent background, ground contact at bottom center, consistent scale with a 200 by 230 pixel game sprite.

Export PNG with transparency and remove any baked-in backdrop, for example with the separately installed `rembg` CLI:

```sh
rembg i noodle-source.png public/assets/buildings/noodle_nook.png
```

Keep the ground footprint in 2:1 isometric projection (tiles are 128×64; a tall building's entire image need not be 2:1). Crop consistently, preserve transparent margins, and position ground contact at bottom center. Add only files that actually exist. For that file, the exact manifest is:

```json
{
  "building_noodle_nook": {
    "file": "buildings/noodle_nook.png",
    "anchorX": 0.5,
    "anchorY": 1,
    "scale": 1
  }
}
```

Supported keys are `building_noodle_nook`, `building_coffee_corner`, `building_sunny_bakery`, `building_taco_tuesday`, `building_tomato_basil`, `building_sushi_station`, `building_river_grill`, `building_market_gelato`, `grass`, `road`, `sidewalk`, `water`, `tree`, `lamp`, `bench`, `walker`, and `coin`. File paths are relative to `public/assets/`. Anchors are normalized image coordinates; `scale` must be positive. Buildings, props, walkers and coins apply the manifest anchor and scale; terrain tiles use centered origins and native size, so supply 128×64 terrain PNGs.

Omitted, invalid or failed keys fall back to procedural textures. Non-terrain fallback anchors are `(0.5, 1)` with scale `1`; terrain defaults are centered. A new empty manifest clears prior presentation metadata. Restaurant panel previews use the loaded texture and the same scale and anchor as the scene (as CSS transform origin). Reload, open the restaurant panel, and check the ground contact, preview and camera zoom at desktop and mobile sizes. `node scripts/qa-assets.mjs` tests an intercepted temporary PNG, custom preview metadata, missing-image fallback and returning to an empty manifest without adding fixture artwork to production.

Save format v4 validates v1/v2/v3 against their frozen six-restaurant schemas before migration, preserving all progress and adding two empty Riverside records. V3 remains Maple-only. Invalid saves remain protected until valid import or explicit reset.

Building door routing uses the same anchor, scale and texture dimensions as the rendered sprite. Replacement art should place its door at the normalized procedural facade location: `(78/200, 211/230)` for the upper row (including River Grill), `(16/200, 180/230)` for the lower row (including Market Gelato). Queue depth remains in front of the doorway.
