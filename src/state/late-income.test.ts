import { expect, it } from 'vitest';
import {
  fresh,
  income,
  accrue,
  collect,
  offlineIncome,
  integratedIncome,
  levelUp,
  upgradeCost,
  netWorth,
} from './economy';
import { restaurants } from '../data/restaurants';
import { parseSave, serialize } from './save';

it.each([
  [1, 0.8875],
  [49, 245],
  [50, 500],
  [51, 515.1],
  [75, 937.5],
  [99, 1475.1],
  [100, 3300],
  [101, 3333],
  [1000, 33000],
])('has independent Noodle income at level %s', (level, expected) => {
  const g = fresh();
  g.restaurants.noodle_nook.level = level;
  const before = structuredClone(g);
  expect(income(g, 'noodle_nook', 0)).toBeCloseTo(expected, 8);
  expect(g).toEqual(before);
});
it('preserves every early level and is finite and bounded for every restaurant through the cap', () => {
  const g = fresh();
  for (const c of restaurants) {
    for (let level = 1; level <= 1000; level++) {
      // One owned restaurant isolates the per-restaurant scaling from street honors.
      g.restaurants = fresh().restaurants;
      g.restaurants.noodle_nook.owned = false;
      g.restaurants[c.id] = {
        owned: true,
        level,
        hasManager: false,
        register: 0,
      };
      const old =
        c.baseIncome *
        level *
        (level >= 100
          ? 16
          : level >= 50
            ? 8
            : level >= 25
              ? 4
              : level >= 10
                ? 2
                : 1) *
        (Math.min(5, 3.5 + level * 0.05) / 4);
      const rate = income(g, c.id, 0);
      expect(Number.isFinite(rate)).toBe(true);
      expect(rate).toBeGreaterThanOrEqual(old);
      expect(rate).toBeLessThanOrEqual(old * 1.5 * (level >= 100 ? 1.1 : 1));
      expect(rate).toBe(
        old *
          (1 + Math.min(50, Math.max(0, level - 50)) / 100) *
          (level >= 100 ? 1.1 : 1),
      );
      if (level <= 50) expect(rate).toBe(old);
    }
    g.restaurants[c.id].owned = false;
    expect(income(g, c.id, 0)).toBe(0);
  }
});
it('composes once with globals, honors, registers, managers, partial boosts and capped offline', () => {
  const g = fresh();
  for (const [id, r] of Object.entries(g.restaurants)) {
    if (!['river_grill', 'market_gelato'].includes(id))
      Object.assign(r, { owned: true, level: 100 });
  }
  g.upgrades = ['ingredients', 'service'];
  // Existing 13,500/s stacks with the separate 1.1 Master multiplier.
  const rate = 13500 * 1.1;
  expect(income(g, 'noodle_nook', 0)).toBe(rate);
  const tick = accrue(g, 0, 2000).data;
  expect(tick.restaurants.noodle_nook.register).toBe(rate * 2);
  expect(collect(tick, 'noodle_nook').coins).toBe(rate * 2);
  expect(accrue(g, 0, 120000).data.restaurants.noodle_nook.register).toBe(
    rate * 60,
  );
  g.restaurants.noodle_nook.hasManager = true;
  g.restaurants.noodle_nook.register = 7;
  g.boostUntil = 1000;
  expect(income(g, 'noodle_nook', 0)).toBe(rate * 2);
  expect(integratedIncome(g, 'noodle_nook', 0, 2000)).toBe(rate * 3);
  expect(accrue(g, 0, 2000).data.coins).toBe(rate * 3 + 7);
  expect(offlineIncome(g, 0, 2000)).toBe(rate * 1.5);
  expect(offlineIncome(g, 0, 9 * 3600000)).toBe(rate * 28801 * 0.5);
});
it('real 50→51 purchase retains cost, gems and all unrelated progress', () => {
  const g = fresh();
  Object.assign(g.restaurants.noodle_nook, {
    level: 50,
    register: 123,
    hasManager: true,
  });
  g.coins = upgradeCost('noodle_nook', 50) + 17;
  g.gems = 42;
  const next = levelUp(g, 'noodle_nook');
  expect(next).toEqual({
    ...g,
    coins: 17,
    restaurants: {
      ...g.restaurants,
      noodle_nook: { ...g.restaurants.noodle_nook, level: 51 },
    },
  });
  expect(income(next, 'noodle_nook', 0)).toBeCloseTo(515.1, 8);
  expect(netWorth(next)).toBeCloseTo(netWorth(g), 5);
});
it.each([1, 2, 3, 4])(
  'derives late income from frozen v%s saves without changing saved progress',
  (version) => {
    const g = fresh();
    Object.assign(g.restaurants.noodle_nook, {
      level: 100,
      register: 321,
      hasManager: true,
    });
    Object.assign(g, {
      coins: 1234,
      gems: 42,
      upgrades: ['ingredients'],
      boostUntil: 601000,
    });
    const wire = JSON.parse(serialize(g, 1000, 234));
    wire.version = version;
    if (version < 4) {
      delete wire.restaurants.river_grill;
      delete wire.restaurants.market_gelato;
    }
    if (version < 3) delete wire.neighborhood;
    const parsed = parseSave(JSON.stringify(wire))!;
    expect(parsed).toEqual({
      ...g,
      version: 4,
      savedAt: 1000,
      pendingOffline: 234,
    });
    expect(income(parsed, 'noodle_nook', 1000)).toBe(12000 * 1.1);
    expect(parseSave(serialize(parsed, 1000, 234))).toEqual(parsed);
  },
);
