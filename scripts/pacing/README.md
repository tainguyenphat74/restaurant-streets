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

## Bounded late income tuning (local release, 2026-10-19)

The table above records the pre-tuning run on `25ea26a`, reproduced before edits.
At that historical release, canonical restaurant income multiplied by `1 + clamp(level - 50, 0, 50) / 100`:
unchanged through 50, +1% at 51, +25% at 75, +50% at 100 and thereafter.
This continuous bounded ramp avoids a new threshold reward or runaway scaling;
it composes once with existing milestones, honors, globals and boosts. Costs,
net worth, level cap, rewards, registers and save schemas are unchanged.

The same simulator and policies (no algorithm changes) produced:

| Policy                                   | Both 50, cumulative seconds (unchanged) | Both 100 before | Both 100 after | Reduction |
| ---------------------------------------- | --------------------------------------: | --------------: | -------------: | --------: |
| No globals / no boosts, active           |                             7,274.63589 |   950,393.26194 |  674,998.89686 |    28.98% |
| Globals, active                          |                             4,221.58421 |   318,594.46100 |  226,796.33822 |    28.81% |
| Globals + earned boosts, active          |                             3,458.32117 |   309,594.46009 |  217,796.33842 |    29.65% |
| Globals + earned boosts, bounded offline |                             3,458.40966 |   585,895.14528 |  423,895.14528 |    27.65% |

Shared both-25 time remains exactly 2,695.0581635742187s. Boost counts and gem
balances remain 0/160, 0/160, 15/10, 15/10 respectively. Offline manager readiness
remains 2,695.1452841796877s; total offline time drops from 518,400 to 374,400s.
The offline result remains schedule-sensitive and includes whole eight-hour
intervals. These are simulated elapsed seconds, not benchmark runtime or human
play measurements. Even after tuning, baseline is 7.81 days and the earned-boost
branch is 2.52 days of optimistic play: this is one improvement, not a claim that
late balance is finished. This historical run predates the individual Master perk.

## Individual Master income perk

Owned restaurants at level 100 or above now receive an automatic individual
+10% income multiplier. That release left income below 100 unchanged. The same simulator and
four earned policies produced these actual cumulative both-100 seconds:

| Policy                                   | Before Master perk |  After Master perk |
| ---------------------------------------- | -----------------: | -----------------: |
| No globals / no boosts, active           |  674998.8968581543 |   670369.192482666 |
| Globals, active                          |  226796.3382175293 |  225253.1046027832 |
| Globals + earned boosts, active          | 217796.33842260743 | 216253.10474951172 |
| Globals + earned boosts, bounded offline |  423895.1452841797 |  394869.5870212402 |

The shared both-25 checkpoint remains 2695.0581635742187 seconds. Both-50
checkpoints remain 7274.635888427734 / 4221.584209472656 /
3458.321171875 / 3458.409656982422 seconds in table order. Boost counts/gem
balances remain 0/160, 0/160, 15/10, 15/10. Offline manager readiness remains
2695.1452841796877 seconds. Total offline seconds change from 374400 to 345600:
the policy still takes discrete eight-hour offline intervals and buys only during
active intervals, so completion is schedule-sensitive rather than a smooth
percentage reduction.

All collection limits, earned-funds/gem constraints, target caps, global purchase
order, boost expiry rules and one-hour-active/eight-hours-offline scheduling above
are unchanged. These are deterministic policy outputs, not optimal strategies or
player metrics; no human latency or save-claim lifecycle is simulated.

## Secondary late tail (local, parent review/browser/live pending)

The original ramp is exact through level 75. Above 75, a second additive
percentage point per level reaches +0.25 at 100: total late multiplier 1.75,
capped thereafter. The individual Master multiplier still applies once.
Costs, rewards, caps, save schema and policy rules are unchanged.

| Policy | Before both-100 seconds | After both-100 seconds |
| --- | ---: | ---: |
| Baseline | 670369.192482666 | 603110.0250305176 |
| Globals | 225253.1046027832 | 202833.38190917968 |
| Earned boosts | 216253.10474951172 | 193833.38220581054 |
| Bounded offline | 394869.5870212402 | 359408.51094921876 |

Both-25 and both-50 checkpoints, boosts/gems and manager readiness remain
exactly unchanged from the preceding table. Offline time is now 316800 seconds
(previously 345600). These deterministic simulated policies are not human
completion metrics or optimality claims; discrete offline scheduling still matters.
