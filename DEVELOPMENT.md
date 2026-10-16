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

- Riverside Market's data/save foundation has passed independent local release gates; publication/live verification is in progress. This is not a playable second neighborhood. Playable expansion is next.
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

### Riverside Market safe data/save foundation — verified locally, publication pending

- Implementation: `e35ee88`. Unchanged six-restaurant Maple catalog extracted into `src/data/maple.ts`; existing catalog API retained. Neighborhood definitions mark Maple active and Riverside inactive/empty: no new street, unlock, purchase or earnings yet.
- Explicit validated v1 → v2 migration, with historical restaurant/upgrade IDs independent of the live catalog. V2 retains the flat state layout. Coins, gems, levels, managers, registers, boosts, global upgrades, pending rewards and timestamps survive exactly; only omitted v1 pending defaults to zero. Migration adds no income; normal import/export/reset/offline semantics remain.
- Unsupported versions, malformed/empty saves and unknown fields are rejected with existing numeric/ownership/timestamp bounds. Review exposed startup overwriting unreadable saves: regression failed first; shared persistence guard now preserves original bytes across startup/autosave/lifecycle saves until valid import or explicit reset. Persistent warning and refused temporary-state export explain that old progress has not been recovered. Storage failures stay visible.
- Regression-first evidence: migration assertions, absent neighborhood definitions, empty stored save and unreadable-startup preservation failed before implementation. Independent final read-only review found no release blockers. No renderer/economy/formula changes; subscriptions remain narrow.
- Parent verification: **69 tests / 13 files** (`npm test`), `npm run build`, and `git diff --check` passed. Existing Vite bundle-size warning remains.
- Stable production preview `http://127.0.0.1:4186`: **all five suites passed**: `qa.mjs` (default WebGL desktop/mobile actual earning/collection/upgrade/purchase/managers/gestures/reload/offline claim), `qa-lifecycle.mjs`, `qa-customers.mjs`, `qa-bulk.mjs`, and new `qa-save.mjs`. Zero page errors. Desktop/mobile fresh screenshots inspected: scene/controls render with no obvious overlap/overflow.
- Save coverage uses supported import/export/reset UI: exact v1 migration, v2 roundtrip, atomic invalid rejection, pending claim/reload idempotency; malformed/unsupported raw localStorage byte-preservation through boot/autosave/reload, invalid import/refused export and explicit recovery. Save/bulk fixture stress uses Canvas; save comparisons use frozen clock/deadline advancement, not natural-progress screenshot evidence. Standard gameplay remains WebGL.
- Earlier agent WebGL run timed out on mobile; final parent stable-preview rerun passed completely. Lifecycle initially failed its obsolete storage-warning text assertion; updated it to verify paused saving plus unavailable-storage explanation in Settings, then reran successfully. No failed gate is hidden.
- Runtime publication and exact deployment/live results will be recorded after verification. Next slice: playable Riverside with versioned migration before catalog/state expansion.
