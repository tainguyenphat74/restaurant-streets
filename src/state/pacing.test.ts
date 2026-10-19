import { expect, it } from 'vitest';
import {
  accrue,
  collect,
  fresh,
  income,
  levelUp,
  totalIncome,
  upgradeCost,
  managerCost,
  hire,
} from './economy';
import { streetHonor } from './honors';
import { neighborhoods } from '../data/neighborhoods';
import { restaurants } from '../data/restaurants';
import { riversideGoalIds, unlockRiverside } from './riverside';

// Deterministic active-play model, not player measurements: collect every <=60s,
// no managers/globals/boosts before unlock, choose the lowest cost/income-gain
// next level (target 25). Wait for that purchase; no offline time or free money.
it('simulates bounded active pacing through the earned goal and Riverside opening', () => {
  let g = fresh(),
    elapsed = 0;
  function afford(cost: number) {
    let steps = 0;
    while (g.coins < cost) {
      const seconds = Math.min(
        60,
        Math.max(0.001, (cost - g.coins) / totalIncome(g, 0)),
      );
      g = accrue(g, 0, seconds * 1000).data;
      for (const c of restaurants) g = collect(g, c.id);
      elapsed += seconds;
      if (++steps > 1000000) throw new Error('Pacing did not converge');
    }
  }
  while (riversideGoalIds.some((id) => g.restaurants[id].level < 25)) {
    const options = riversideGoalIds
      .filter((id) => g.restaurants[id].level < 25)
      .map((id) => {
        const level = g.restaurants[id].level;
        const cost = level
          ? upgradeCost(id, level)
          : restaurants.find((c) => c.id === id)!.baseCost;
        const next = levelUp({ ...g, coins: cost }, id);
        return {
          id,
          cost,
          ratio: cost / (income(next, id, 0) - income(g, id, 0)),
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
    afford(options[0].cost);
    g = levelUp(g, options[0].id);
  }
  const goalSeconds = elapsed,
    goalRate = totalIncome(g, 0);
  g = unlockRiverside(g);
  const openings: Record<string, number> = {};
  for (const id of ['river_grill', 'market_gelato']) {
    afford(restaurants.find((c) => c.id === id)!.baseCost);
    g = levelUp(g, id);
    openings[id] = elapsed - goalSeconds;
    afford(managerCost(id));
    g = hire(g, id);
  }
  const bothManagedSecondsAfterGoal = elapsed - goalSeconds;
  while (
    ['river_grill', 'market_gelato'].some((id) => g.restaurants[id].level < 25)
  ) {
    const options = ['river_grill', 'market_gelato']
      .filter((id) => g.restaurants[id].level < 25)
      .map((id) => {
        const cost = upgradeCost(id, g.restaurants[id].level);
        return {
          id,
          cost,
          ratio:
            cost /
            (income(levelUp({ ...g, coins: cost }, id), id, 0) -
              income(g, id, 0)),
        };
      })
      .sort((a, b) => a.ratio - b.ratio);
    afford(options[0].cost);
    g = levelUp(g, options[0].id);
  }
  expect(g.neighborhood.unlockedStreets).toHaveLength(2);
  expect(g.restaurants.market_gelato.hasManager).toBe(true);
  expect(Number.isFinite(elapsed)).toBe(true);
  // Wide regression bounds for this idealized policy, not UX/player guarantees.
  expect(goalSeconds).toBeGreaterThan(15 * 60);
  expect(goalSeconds).toBeLessThan(60 * 60);
  expect(elapsed - goalSeconds).toBeGreaterThan(5 * 60);
  expect(elapsed - goalSeconds).toBeLessThan(60 * 60);
  const bothRiverside25 = elapsed - goalSeconds;
  const checkpoints: Record<string, number> = {};
  // Continue the same earned fresh run: all streets 25 -> 50 -> 100.
  // Greedy marginal TOTAL income includes the street-wide final-level benefit.
  // No speculative spending above the current target; no free funds or time skips.
  for (const target of [50, 100]) {
    const start = elapsed;
    while (restaurants.some((c) => g.restaurants[c.id].level < target)) {
      const options = restaurants
        .filter((c) => g.restaurants[c.id].level < target)
        .map((c) => {
          const cost = upgradeCost(c.id, g.restaurants[c.id].level);
          const next = levelUp({ ...g, coins: cost }, c.id);
          return {
            id: c.id,
            cost,
            ratio: cost / (totalIncome(next, 0) - totalIncome(g, 0)),
          };
        })
        .sort((a, b) => a.ratio - b.ratio);
      afford(options[0].cost);
      g = levelUp(g, options[0].id);
      for (const street of neighborhoods) {
        const key = `${street.id}-${target}`;
        if (
          !checkpoints[key] &&
          streetHonor(g, street.id).multiplier === (target === 50 ? 1.25 : 1.5)
        )
          checkpoints[key] = elapsed;
      }
    }
    expect(elapsed).toBeGreaterThan(start);
    expect(elapsed - start).toBeLessThan(365 * 24 * 3600);
    for (const street of neighborhoods)
      expect(streetHonor(g, street.id).multiplier).toBe(
        target === 50 ? 1.25 : 1.5,
      );
  }
  console.log(
    JSON.stringify({
      model:
        'active, <=60s collections, lowest marginal payback to Maple 25; then River Grill + manager, Gelato + manager',
      checkpoints,
      goalSeconds,
      goalRate,
      openings,
      bothManagedSecondsAfterGoal,
      bothRiverside25SecondsAfterGoal: bothRiverside25,
    }),
  );
});
