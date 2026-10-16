# Restaurant Streets — Development Log

## Working agreement

The owner authorized continuous autonomous development of this game: small coherent changes, tests, focused commits, regular pushes, and verified releases to https://restaurant-streets.tainguyenphat.com/. No per-release approval is required. Keep this file current so progress is visible in GitHub.

Scope: this repository and its existing Vercel project only. Preserve player saves and earned progress. Do not reset players, force-push, buy services, add monetization/tracking, change credentials, or modify unrelated infrastructure. Prestige must remain optional and is not the current priority. No real-user statistics are available; never claim measured retention or completion times.

## Release discipline

- Inspect current Git state and this file before work; resume intended interrupted work rather than overwriting it.
- Build the smallest independently useful slice. Use focused sequential commits, not an artificial history after a giant implementation.
- Keep pure economy logic testable; use Codex for implementation and independent review/testing before publication.
- Require unit tests, TypeScript/production build, relevant desktop/mobile browser interactions, and save compatibility checks.
- Push normally to `main` only after checks pass. Verify the exact source commit in Vercel, Ready production state, custom-domain alias, and real live interactions before marking a release live.
- A `main` push currently creates a preview. Inspect it, then promote the exact verified deployment to production if needed. Do not blindly issue duplicate `vercel --prod` builds.
- Failed verification means no release. Record the blocker and retain recoverable work. Never discard somebody else's changes or overwrite player saves to make tests pass.
- Scheduled runs take at most one coherent release and then stop. Avoid overlapping writers. When the queue is complete, audit and fix meaningful regressions rather than adding filler features.

## Prioritized queue

| Item | Status | Acceptance boundary |
| --- | --- | --- |
| Bulk upgrades and clear milestone progress | In progress | Buy 1 / 10 / next milestone / max; exact sequential costs and milestone gems; level cap enforced; unchanged existing saves; usable mobile controls. Display existing milestone rewards honestly without silently rebalancing income. |
| Riverside Market — safe data/save foundation | Queued | Separate neighborhood definitions and versioned migration preserving all existing coins, gems, restaurants, managers, boosts and pending offline rewards; strict invalid-save handling. Keep incomplete features inactive. |
| Riverside Market — playable expansion | Queued | Clear earned unlock goal; distinct second street and restaurants; switch streets without losing Maple Street; both neighborhoods earn correctly; purchases, managers, offline income, depth and touch controls work. Choose documented, simulation-tested pacing rather than unbounded inflation. |
| Late-game milestones and balance | Queued | Simulate fresh/mid/late progression and document assumptions; add worthwhile achievable goals after the existing reward milestones without nerfing earned progress or simply raising the cap. |
| Restaurant mastery | Queued | Short permanent achievement tracks with idempotent rewards and visible cosmetic/perk unlocks; old saves remain valid; no mandatory reset or daily-streak penalty. |
| Expansion and mastery polish | Queued | Discoverable goals, useful completion state, mobile usability, accessibility, performance and regression coverage. |

Split any large item into smaller tested releases and update this table. Do not label a data-only foundation as a playable neighborhood.

## Published baseline

- Richer cuisine-specific procedural storefronts and sidewalk customer visits are live.
- Doorway draw-order fix: `4a70aac`.
- Verification at handoff: 53 unit tests; production build; desktop/mobile live earning, upgrades, purchases, managers, offline claims, saves, gestures and customer visit cycles passed with zero page errors.

## Current activity

- Beginning bulk upgrades and existing-milestone progress. Implementation and release verification pending.
- Autonomous continuation is being configured on a two-hour cadence; no claim of scheduled execution until the scheduler confirms creation.

## Release history

New entries must separate implemented, tested, pushed, deployment-ready and live-verified states, and include real commit/deployment handles and any limitations.
