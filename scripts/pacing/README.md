# Current-policy late-game comparison

Reproduce with `npm test -- scripts/pacing/comparison.test.ts --silent=false`.
The old `src/state/pacing.test.ts` remains unchanged. These helpers are outside
runtime source and have no runtime imports pointing to them.

Shared fresh policy: collect all registers every at most 60 seconds; buy the
lowest cost / marginal total income next level through Maple 25. Unlock Riverside,
open River Grill and hire its manager, then open Gelato and hire its manager.
Continue Riverside to 25. Every purchase waits for actual earned funds. Candidates
with hypothetical affordability are used ONLY for ranking, never as run state.
The shared checkpoint is 2,695.05816 seconds, with 80 earned milestone gems.

Each branch continues the same state through both streets 50 then 100; no upgrades
above the current target. Globals buys both existing upgrades in catalog order
for 2,500 + 15,000 earned coins after the checkpoint. Boosts also buys rush hour
whenever waiting for coins, if expired and at least 10 earned gems remain.
No boost stacking, extra gems, grants, resets or candidate-state adoption.
Offline uses the same globals/boost policy, pays for all remaining managers,
then repeats 1 hour active / 8 hours offline. Purchases occur only while active;
a full offline interval can overshoot a target's affordability. Schedule starts
at 2,695.14528 seconds, after every manager is hired. No boost is bought while away.

| Policy                                            | Both 50, cumulative seconds | Both 100, cumulative seconds | Boosts bought | Gems left | Offline seconds |
| ------------------------------------------------- | --------------------------: | ---------------------------: | ------------: | --------: | --------------: |
| No globals / no boosts, active                    |                 7,274.63589 |                950,393.26194 |             0 |       160 |               0 |
| Globals, active                                   |                 4,221.58421 |                318,594.46100 |             0 |       160 |               0 |
| Globals + earned boosts, active                   |                 3,458.32117 |                309,594.46009 |            15 |        10 |               0 |
| Globals + earned boosts, bounded offline schedule |                 3,458.40966 |                585,895.14528 |            15 |        10 |         518,400 |

These are deterministic model outputs, not player metrics or optimality claims.
The globals and boosts branch still takes about 3.58 cumulative days, versus 11.00
for baseline and 6.78 for this offline schedule. This is evidence before non-nerf
tuning, not balance completion. Globals are deliberately delayed to the shared
25 checkpoint, so this does not estimate a fresh globals-first strategy.
Human latency is zero and active collection is optimistic. Boosted collection
uses at most 30-second intervals, splitting at expiry to respect the production
register cap. Timestamps advance from a fixed epoch; boost lifetime is real
elapsed simulated time. Levels, currencies and timestamps continue across targets.

All accrual, purchases, hiring, boosts and offline amounts use production economy
functions and actual prices. Offline credit is applied once per disjoint interval
directly in the analysis state: this does NOT simulate UI save claiming. No active
accrual is run over those offline intervals. Small independent expectations cover
0.8875/s fresh income, 13.3125 coins over a partially boosted managed 10 seconds,
6.65625 offline coins for that interval, and 12,780 coins for a capped unboosted
9-hour absence. Loop bounds, finite balances, earned gem accounting, deterministic
repeatability and checkpoint continuity are tested. This comparison does not test
human schedules, optimal boost timing, save lifecycle or proposed balance changes.
