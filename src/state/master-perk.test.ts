import { expect, it } from 'vitest';
import { masterIncomeMultiplier } from './master-perk';
import {
  fresh,
  income,
  levelUp,
  upgradeCost,
  accrue,
  integratedIncome,
  offlineIncome,
} from './economy';

it('earns only the individual Master multiplier at an actual 99→100 purchase', () => {
  const g = fresh();
  Object.assign(g.restaurants.noodle_nook, { level: 99, register: 17 });
  Object.assign(g.restaurants.coffee_corner, { owned: true, level: 50 });
  g.coins = upgradeCost('noodle_nook', 99) + 32;
  g.gems = 23;
  const before = structuredClone(g);
  const other = income(g, 'coffee_corner', 0);
  expect(income(g, 'noodle_nook', 0)).toBeCloseTo(1712.7, 8);
  const next = levelUp(g, 'noodle_nook');
  expect(next).toEqual({
    ...g,
    coins: 32,
    gems: 28,
    restaurants: {
      ...g.restaurants,
      noodle_nook: { ...g.restaurants.noodle_nook, level: 100 },
    },
  });
  expect(income(next, 'noodle_nook', 0)).toBe(3500 * 1.1);
  expect(income(next, 'coffee_corner', 0)).toBe(other);
  expect(income(next, 'river_grill', 0)).toBe(0);
  expect(g).toEqual(before);
});

it('routes Master once through registers, managers, partial boosts and offline', () => {
  const g = fresh();
  g.restaurants.noodle_nook.level = 100;
  const rate = 3500 * 1.1;
  expect(accrue(g, 0, 2000).data.restaurants.noodle_nook.register).toBe(
    rate * 2,
  );
  expect(accrue(g, 0, 120000).data.restaurants.noodle_nook.register).toBe(
    rate * 60,
  );
  g.restaurants.noodle_nook.hasManager = true;
  g.restaurants.noodle_nook.register = 7;
  g.boostUntil = 1000;
  expect(integratedIncome(g, 'noodle_nook', 0, 2000)).toBe(rate * 3);
  expect(accrue(g, 0, 2000).data.coins).toBe(rate * 3 + 7);
  expect(offlineIncome(g, 0, 2000)).toBe(rate * 1.5);
  g.restaurants.noodle_nook.owned = false;
  expect(income(g, 'noodle_nook', 0)).toBe(0);
});

it.each([0, 1, 25, 50, 99, 100, 101, 1000])(
  'derives the perk solely from ownership and level %s',
  (level) => {
    expect(masterIncomeMultiplier(false, level)).toBe(1);
    expect(masterIncomeMultiplier(true, level)).toBe(level >= 100 ? 1.1 : 1);
  },
);
