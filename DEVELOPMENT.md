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
| Riverside Market — safe data/save foundation | **Live** | Separate neighborhood definitions and versioned migration preserving existing coins, gems, restaurant levels/managers/registers, boosts and pending offline rewards; strict invalid-save handling. Incomplete features stay inactive. |
| Riverside Market — playable expansion | **In progress** | Readiness goal UI shipped separately; still no playable second neighborhood. V3 migration implemented locally (not published); next: earned unlock, distinct second street/restaurants and safe street switching; both neighborhoods earn correctly; purchases/managers/offline income/depth/touch work. Document simulation-tested pacing. |
| Late-game milestones and balance | Queued | Simulate fresh/mid/late progression; add achievable goals beyond current rewards without nerfing earned progress or merely raising caps. |
| Restaurant mastery | Queued | Short permanent achievement tracks, idempotent rewards, visible cosmetic/perk unlocks; valid old saves survive; no forced reset or daily-streak penalty. |
| Expansion and mastery polish | Queued | Discoverable goals, completion state, accessibility, mobile usability, performance and regression coverage. |

Split large items into smaller tested releases. A data foundation is not a playable neighborhood.

## Current activity and automation

- Riverside readiness remains the published baseline. Explicit v3 save migration is now implemented locally, pending parent browser verification and release. Playable Riverside is next and is not shipped: add a versioned catalog expansion, earned unlock based on the six Maple level-25 goal, and street switching with both streets’ purchase/manager/offline flows. No further goal-only slice is needed.
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

### Riverside Market safe data/save foundation — live

- Implementation: `e35ee88`. Unchanged six-restaurant Maple catalog extracted into `src/data/maple.ts`; existing catalog API retained. Neighborhood definitions mark Maple active and Riverside inactive/empty: no new street, unlock, purchase or earnings yet.
- Explicit validated v1 → v2 migration, with historical restaurant/upgrade IDs independent of the live catalog. V2 retains the flat state layout. Coins, gems, levels, managers, registers, boosts, global upgrades, pending rewards and timestamps survive exactly; only omitted v1 pending defaults to zero. Migration adds no income; normal import/export/reset/offline semantics remain.
- Unsupported versions, malformed/empty saves and unknown fields are rejected with existing numeric/ownership/timestamp bounds. Review exposed startup overwriting unreadable saves: regression failed first; shared persistence guard now preserves original bytes across startup/autosave/lifecycle saves until valid import or explicit reset. Persistent warning and refused temporary-state export explain that old progress has not been recovered. Storage failures stay visible.
- Regression-first evidence: migration assertions, absent neighborhood definitions, empty stored save and unreadable-startup preservation failed before implementation. Independent final read-only review found no release blockers. No renderer/economy/formula changes; subscriptions remain narrow.
- Parent verification: **69 tests / 13 files** (`npm test`), `npm run build`, and `git diff --check` passed. Existing Vite bundle-size warning remains.
- Stable production preview `http://127.0.0.1:4186`: **all five suites passed**: `qa.mjs` (default WebGL desktop/mobile actual earning/collection/upgrade/purchase/managers/gestures/reload/offline claim), `qa-lifecycle.mjs`, `qa-customers.mjs`, `qa-bulk.mjs`, and new `qa-save.mjs`. Zero page errors. Desktop/mobile fresh screenshots inspected: scene/controls render with no obvious overlap/overflow.
- Save coverage uses supported import/export/reset UI: exact v1 migration, v2 roundtrip, atomic invalid rejection, pending claim/reload idempotency; malformed/unsupported raw localStorage byte-preservation through boot/autosave/reload, invalid import/refused export and explicit recovery. Save/bulk fixture stress uses Canvas; save comparisons use frozen clock/deadline advancement, not natural-progress screenshot evidence. Standard gameplay remains WebGL.
- Earlier agent WebGL run timed out on mobile; final parent stable-preview rerun passed completely. Lifecycle initially failed its obsolete storage-warning text assertion; updated it to verify paused saving plus unavailable-storage explanation in Settings, then reran successfully. No failed gate is hidden.
- Published source: `5cf09fcce8a4eb43a51a55c7320e8d668054ec08` on main (implementation `e35ee88`, lifecycle QA/release gates `5cf09fc`). Normal fast-forward push; no force push or resets. Independent review found no blockers.
- Git-triggered preview `dpl_EhfPdVBpyGZPny2Z1HXpoLCzZg68` was promoted once; resulting production rebuild `dpl_F7iEJ5ApVD27mKmHk7aeWXMt46rH`, https://restaurant-streets-dc8418l0y-nguyentai2760gmailcoms-projects.vercel.app, is **Ready / production**, metadata SHA exactly `5cf09fcce8a4eb43a51a55c7320e8d668054ec08`. No duplicate `vercel --prod` build.
- Custom-domain alias verified by deployment inspection; HTTPS **200** at https://restaurant-streets.tainguyenphat.com/. Deployed asset `index-BwXCyIPC.js` contains the new save-protection warnings; live Settings export reports v2. Hosted asset hashes differ from the local build, so verification used source metadata plus real behavior/feature markers, not a false hash-equality claim.
- **All five suites passed on the custom domain:** `qa-save.mjs`, `qa.mjs`, `qa-lifecycle.mjs`, `qa-customers.mjs`, `qa-bulk.mjs`, desktop/mobile with zero page errors. Verified actual earning/upgrades, v1 migration/export, v2 reload, pending claim idempotency, raw invalid-save protection and explicit recovery. Canvas fixture/default-WebGL distinction above remains applicable.
- Verification caveat: authenticated `vercel curl` automatically generated a project deployment-protection bypass token; no token was printed or committed and protection was not disabled. Public-domain gameplay verification used ordinary unauthenticated browser contexts. No further credential changes were made.
- Next slice: playable Riverside with versioned migration before catalog/state expansion. This release does not add playable Riverside content. Final evidence is a docs-only push, requiring no additional promotion.

### Riverside earned-goal readiness — live

- Small slice toward expansion: Kitchen shows the six historical Maple restaurants, each level and completion, overall level-25 ownership goal, and accessible Visit buttons. Ready status is derived from existing earned progress. Explicitly unavailable even when complete: no Riverside unlock, new restaurant, purchase, income or reward. This is **not a playable expansion**.
- Focused commits: `140f041` pure readiness/tests; `edae217` Kitchen UI/styles and desktop/mobile QA. Historical v1/v2 schemas, migration, economy and active catalog are unchanged. No new persisted state is necessary. Goal/row subscriptions return primitives and ignore register ticks.
- Codex ran under `flock -n` with bounded scope. Tests were added first and failed on the missing readiness module, then passed with implementation. Codex browser launch failed in its sandbox (`Operation not permitted`); parent continued direct verification without changing model/credentials/services. No failed browser run was treated as a pass.
- Read-only independent review found one blocker in the **test fixture**: `pending` instead of v2 `pendingOffline`. Corrected the fixture, not the strict save validator; parent added actual mobile tap and touch-target checks. No runtime release blocker remained after review and passing gates.
- Parent verification: `npm test` **72 tests / 14 files**, `npm run build`, `git diff --check`, and `npm audit --omit=dev --audit-level=high` (zero production dependency vulnerabilities) passed. Existing bundle-size warning remains.
- Stable production preview `http://127.0.0.1:4187`: **all six suites passed**: `qa.mjs`, `qa-lifecycle.mjs`, `qa-customers.mjs`, `qa-bulk.mjs`, `qa-save.mjs`, `qa-riverside.mjs`. Zero page errors. WebGL standard gameplay remains covered; repeated save/bulk/readiness fixtures use Canvas due documented headless GPU stalls.
- New desktop/mobile coverage: fresh zero completion, real earning/collection/upgrade updates the goal row, supported imports with partial/exact/above-target levels, all-ready reload, keyboard and real mobile tap navigation, touch bounds, reset, no overflow, no goal rewards/purchases or new restaurant IDs. Fresh desktop/mobile Kitchen screenshots inspected; no overlap or horizontal overflow. Advanced fixtures are not presented as natural progress.
- Published source: `920cb2c8a9f088da72b3a44666eab930e22cc2be` on main, following implementation commits above. Normal fast-forward push only. Git-triggered preview `dpl_6vBu6JTWNGag8sSnnnx5ZGRca1uX` was promoted once; resulting rebuild `dpl_Aepd9o9xc7Dj1q9V3abY9ifSGHLy`, https://restaurant-streets-f32hkidhz-nguyentai2760gmailcoms-projects.vercel.app, is **Ready / production**, with metadata SHA exactly matching published source. No duplicate production deployment.
- Production inspection confirms custom-domain alias; unauthenticated HTTPS **200** at https://restaurant-streets.tainguyenphat.com/. Live asset `/assets/index-D85WsKuR.js` matches the tested build filename and contains both the goal heading and unavailable message. No authenticated curl, protection/credential/DNS changes, or new infrastructure.
- **All six suites passed on the custom domain**, including new `qa-riverside.mjs` and existing WebGL gameplay/lifecycle/customer/bulk/save coverage. Actual desktop/mobile earning → collection → upgrade → goal-row update, supported partial/ready fixtures → reload, reset, touch and keyboard navigation, invalid-save byte protection, pending claim idempotency and all regression flows passed with zero page errors. Final evidence is a docs-only push; no additional promotion is needed.
- Next: explicit v3 migration before adding a playable Riverside catalog, earned unlock and neighborhood switching; then verify both streets’ purchase/manager/offline flows and pacing. No further goal-only release is needed.

### Explicit v3 neighborhood save foundation — local implementation, not published

- Bounded scope: GameData now carries `neighborhood: { currentStreet, unlockedStreets }`, initially and exclusively `maple_street`. V3 strictly rejects missing/extra/inconsistent neighborhood state, unknown streets and inactive Riverside. No new catalog IDs, unlocks, rewards, purchases, income, UI, renderer, cap or formula changes; external sprites, teardown, touch and narrow selectors are unchanged.
- V1/v2 validate against frozen historical restaurant/upgrade IDs before migration. Every existing progress field and timestamp is retained; only omitted v1 pending rewards default to zero. Historical Maple neighborhood defaults are literal and independent of the live catalog. Load/import/save/reset carry the new state; corrupt raw-save protection remains intact.
- TDD evidence: new focused regression file ran before implementation; **3 failed / 1 passed**. V1/v2 returned version 2 without neighborhood state and v3 import returned false. After implementation, the focused migration files passed **7 tests**; full `npm test` passed **77 tests / 15 files**. `npm run build` and `git diff --check` passed; the existing Vite bundle-size warning remains. Updated save QA also passed `node --check`.
- Browser QA updated for v1 AND v2 → v3, v3 roundtrip/reload, invalid neighborhood rejection with byte-unchanged storage, pending claim idempotency, reset and corrupt v3 startup/autosave/lifecycle protection. Existing historical browser fixtures explicitly remove v3 neighborhood fields. Standard gameplay remains default WebGL; fixture stress remains Canvas.
- Codex Chromium launch and Git staging were blocked by its workspace sandbox (`Operation not permitted` / read-only `.git`); no sandbox, credentials or services were changed. Parent completed independent verification and handles focused commits/publication while the same exclusive release lock remains held.
- Independent read-only review found no release blockers. Parent strengthened the suggested zero-duration test with positive-duration accrual, offline claim and repeated-claim assertions; all **77 tests / 15 files** passed again. Parent `npm run build` and `git diff --check` passed.
- Stable production preview `http://127.0.0.1:4188`: **all six suites passed** (`qa-save.mjs`, `qa.mjs`, `qa-lifecycle.mjs`, `qa-customers.mjs`, `qa-bulk.mjs`, `qa-riverside.mjs`). Desktop/mobile migrations, exact exported progress, v3 roundtrip/reload, atomic invalid-neighborhood rejection, raw-save byte protection across startup/autosave/lifecycle, single pending claim, reset, real earning/collection/upgrade and touch/keyboard/navigation regressions passed with zero page errors. Fresh desktop/mobile screenshots visually inspected; no new overlap/missing scene. Standard gameplay uses WebGL; save/bulk fixture stress uses Canvas. Publication and live verification remain pending.
- Next playable slice: versioned Riverside catalog/state expansion, earned unlock and street switching, followed by both streets’ purchase/manager/offline and pacing verification. Riverside remains inactive and **not shipped** by this local foundation.
