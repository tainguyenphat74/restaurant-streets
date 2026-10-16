# Restaurant Streets — Development Log

## Working agreement

The owner authorized continuous autonomous development of this game: small coherent changes, tests, focused commits, regular pushes, and verified releases to https://restaurant-streets.tainguyenphat.com/. No per-release approval is required. This file is the visible progress record.

Scope: this repository and its existing Vercel project only. Preserve player saves and earned progress. Do not reset players, force-push, buy services, introduce monetization/tracking, change credentials, or modify unrelated infrastructure. Prestige must remain optional; expansion comes first. No real-user statistics are available: simulation assumptions are not measured retention or completion times.

## Release discipline

- Inspect Git state and this file first; preserve and resume intended interrupted work instead of overwriting it.
- Build small independently useful slices and commit sequentially. Prefer Codex implementation and independent review/testing; if its CLI quota blocks a bounded task, direct implementation with the same tests/review is permitted by the owner's broad authorization. Record actual blockers rather than endlessly retrying.
- Require unit tests, TypeScript/production build, diff checks, relevant desktop/mobile browser interactions and save compatibility checks before publication.
- Push normally to `main` only after checks pass. A main push currently creates a preview: wait for the exact SHA's deployment, promote it if needed, and wait for the resulting production deployment. Never blindly create duplicate deployments.
- Verify source SHA, Ready production state, custom-domain alias and actual live feature interactions before marking a release live. A docs-only push after verification needs no promotion when runtime code is unchanged.
- Failed verification means no release. Record blockers and retain recoverable work. Never discard other work or overwrite player saves to make tests pass.
- Scheduled runs take one coherent release at most. Avoid overlapping writers using `/tmp/restaurant-streets-autodev.lock`. When the queue is complete, audit and fix meaningful regressions rather than adding filler features.

## Prioritized queue

| Item | Status | Acceptance boundary |
| --- | --- | --- |
| Bulk upgrades and clear milestone progress | **Live** | Buy 1 / Buy 10 / Next milestone / Buy max; partial affordable quantities quoted honestly; exact sequential costs/gems; cap enforced; unchanged old saves; mobile controls. |
| Riverside Market — safe data/save foundation | **Implemented locally; not live** | Separate neighborhood definitions and versioned migration preserving existing coins, gems, restaurant levels/managers/registers, boosts and pending offline rewards; strict invalid-save handling. Incomplete features stay inactive. |
| Riverside Market — playable expansion | Queued | Earned unlock goal, distinct second street/restaurants, switch streets without losing Maple Street, both neighborhoods earn correctly; purchases/managers/offline income/depth/touch work. Document simulation-tested pacing. |
| Late-game milestones and balance | Queued | Simulate fresh/mid/late progression; add achievable goals beyond current rewards without nerfing earned progress or merely raising caps. |
| Restaurant mastery | Queued | Short permanent achievement tracks, idempotent rewards, visible cosmetic/perk unlocks; valid old saves survive; no forced reset or daily-streak penalty. |
| Expansion and mastery polish | Queued | Discoverable goals, completion state, accessibility, mobile usability, performance and regression coverage. |

Split large items into smaller tested releases. A data foundation is not a playable neighborhood.

## Current activity and automation

- Bulk-upgrade release remains the published baseline. Riverside Market's compatibility foundation is implemented locally only; the owner authorized parent publication, but this continuation explicitly stops after one local commit with no push or deployment. Playable expansion remains queued and was not started.
- Autonomous continuation is configured every two hours with local delivery; progress belongs here rather than frequent chat messages.
- The first two scheduled runs were blocked before execution by provider quota (429); they made no game changes. Codex CLI separately hit its usage limit during the performance correction, which was completed directly. A configured schedule does not prove a run succeeded. Resume from this file on the next healthy run.

## Release history

### Bulk upgrades and milestone progress — live

- Runtime source: `159ef10c24c044fd80714a993126d3888b43f830` on main.
- Focused commits: `a07d151` (pure quote/purchase helpers), `df67213` (store/UI/browser tests), `159ef10` (review performance correction and test).
- UI: Buy 1, Buy 10, Next milestone and Buy max; actual affordable levels/cost/gems; existing milestone progress and explicit level-100 reward completion / level-1000 cap.
- Existing income/cost formulas, milestone schedule, version-1 save format and single-purchase semantics are unchanged. This release improves upgrade usability; it does not yet add endgame content.
- Independent review caught up to 999 immutable simulated game allocations per quote plus a full-data React subscription. Regression failed first; quotes now use scalar sequential arithmetic, actual purchases copy the restaurant map once, and the panel memoizes on relevant inputs.
- Verification: **62 unit tests / 10 files**; TypeScript + production build; diff checks. Desktop/mobile fresh earning, default upgrades, bulk cost/count, exact/insufficient funds, milestone gems, completion, cap, imports/reload, keyboard and overflow passed. Standard WebGL gameplay, purchases/managers/offline claims/gestures passed. Customer suite passed locally.
- Headless-only limitation: WebGL bulk-fixture stress stalled on mobile twice. Changing only the renderer to Canvas passed all fixtures. `qa-bulk.mjs` therefore defaults to Canvas; `QA_WEBGL=1` enables the additional GPU stress path. `qa.mjs` still exercises default WebGL desktop/mobile gameplay. Do not hide this distinction in reports.
- Production deployment: `dpl_319FhMyfHAvHeZew2Bfc2ZdSjK5M`, https://restaurant-streets-2328a6yvh-nguyentai2760gmailcoms-projects.vercel.app (Ready, exact runtime SHA).
- Live alias https://restaurant-streets.tainguyenphat.com/ confirmed on that deployment. **Live desktop/mobile bulk suite, standard gameplay suite and lifecycle suite passed with zero page errors.**
- Existing Vite bundle-size warning remains.

### Storefronts and ambient customers — live baseline

- Cuisine-specific procedural storefronts; same-side sidewalk approach, queue, hidden dining and return; external walker asset support and runtime reduced-motion behavior.
- Doorway draw-order fix: `4a70aac`.
- Original verification: 53 unit tests, production build and desktop/mobile live gameplay/customer cycles, with zero page errors.

### Riverside Market safe data/save foundation — local only

- Extracted the unchanged six-restaurant Maple catalog into `src/data/maple.ts`, retaining the existing `restaurants.ts` API. Explicit neighborhood metadata marks Maple active and Riverside inactive with no restaurant entries, purchases, income or UI promises.
- Added the validated v1 → v2 save boundary before moving catalog data. V2 deliberately retains the flat state layout; historical restaurant and global-upgrade IDs are pinned independently of future playable catalogs. All currencies, levels, managers, registers, boosts, upgrades, pending rewards and source timestamps survive migration exactly. Only omitted v1 pending rewards normalize to zero; v2 requires that field.
- Unsupported/non-numeric versions, malformed records, unknown fields and empty stored saves fail validation. Existing numeric, ownership, level, timestamp and boost bounds remain. Import/export/reset and elapsed-offline behavior retain their existing semantics; migration itself adds no earnings.
- Tests first: observed two migration assertion failures and the missing-neighborhood-module failure before implementation. Also observed the empty-stored-save regression fail before its fix. Existing save tests now use v3 as unsupported and expect v2 exports.
- Performance review: no economy/formula or renderer changes; recovery adds one boolean store flag and UI subscription. Validation/copying remains linear in the fixed six-record save, outside the tick path. Maple catalog contents compared exactly with the prior source.
- Local validation: `npm test` passed **66 tests / 12 files**; `npm run build`, targeted Prettier checks and `git diff --check` passed. Existing Vite bundle-size warning remains. These were the earlier local results before the startup protection review; final continuation results follow below.
- `QA_URL=http://127.0.0.1:4174 node scripts/qa-save.mjs` passed desktop/mobile using supported Settings import/export/reset controls: exact v1 migration, v2 roundtrip, invalid-import rejection without state changes, pending reward reload/claim idempotency, and zero page errors. Uses Canvas and a frozen Playwright clock for exact balance comparisons, following the existing bulk fixture convention; no direct store writes. Test development corrected modal-blocked Settings access, normal pagehide managed-register transfers, and reset fixture expectations.
- Existing `qa-bulk.mjs` passed desktop/mobile with its unchanged v1 fixtures and zero page errors. Additional default-WebGL `qa.mjs` passed desktop earning/upgrades/gestures/tabs/reload but timed out on the mobile Close restaurant interaction (line 83); the full WebGL suite is **not** claimed passing. Renderer code was not changed. An initial save-suite run reached the pre-existing preview before the new build completed and correctly observed old v1 exports; final save verification used the completed build on the separate local preview.
- Next status: foundation implemented locally with the WebGL limitation above; not published. Playable Riverside remains queued, not implemented or live. This task stops at the foundation.

### Startup save protection — same foundation continuation

- Regression first: both malformed raw JSON and unsupported-version startup tests failed at the first byte-equality assertion: startup had overwritten each with fresh v2 data.
- Added a persistence guard for unreadable saves (including storage read failures), shared by startup, autosave, visibility, pagehide, beforeunload and explicit saves. Invalid imports retain the guard; only a validated import or explicit reset releases it. No forced reset.
- Persistent warning explains that raw saved data remains untouched and directs players to valid import or reset. Protected temporary-state export is refused with an explicit explanation that old progress has not been recovered. Storage access/write errors remain separate and visible, including failed recovery writes.
- Final unit validation: **69 tests / 13 files** pass. Production TypeScript/Vite build passes with the existing bundle-size warning. No renderer or economy changes.
- Final browser validation: `QA_URL=http://127.0.0.1:4175 node scripts/qa-save.mjs` passed desktop and mobile against the completed production build, zero page errors. All previous migration/roundtrip/invalid-import/pending-claim/reset assertions pass, including the corrected initial-register reset expectation. New actual-localStorage cases preserve malformed and unsupported raw strings byte-for-byte through boot, autosave, pagehide/reload, invalid import and refused export, then verify explicit reset or valid import resumes writes and survives reload.
- Browser fixtures use Canvas and Playwright clock advancement; new autosave cases fast-forward past each deadline, firing due timers once. An initial run using every intervening animation frame was stopped for runtime cost before completion, then the full suite passed with deadline advancement. This is local save coverage, not a new claim of full WebGL verification.
- Targeted formatting and `git diff --check` passed. The entire preserved foundation plus startup fix is recorded in one coherent local commit; no staged-history reconstruction, push, deployment or live verification. Owner authorization for parent publication remains in place; this continuation stops at the local commit as requested.
