import { expect, it } from 'vitest';
import {
  fresh,
  income,
  accrue,
  collect,
  offlineIncome,
  levelUp,
  upgradeCost,
} from './economy';
import { neighborhoods } from '../data/neighborhoods';
import { streetHonor, honorMultiplier } from './honors';
import { parseSave, serialize } from './save';

function fixture(level: number) {
  const g = fresh();
  g.neighborhood.unlockedStreets.push('riverside_market');
  for (const r of Object.values(g.restaurants))
    Object.assign(r, { owned: true, level });
  return g;
}
it.each([
  [49, 1],
  [50, 1.25],
  [51, 1.25],
  [99, 1.25],
  [100, 1.5],
  [101, 1.5],
])('derives level %s tier without writes', (level, multiplier) => {
  const g = fixture(level),
    before = JSON.stringify(g);
  for (let i = 0; i < 3; i++)
    for (const street of neighborhoods)
      expect(streetHonor(g, street.id).multiplier).toBe(multiplier);
  expect(JSON.stringify(g)).toBe(before);
});
it('requires every ownership and unlock, isolates streets and handles unknown ids', () => {
  const g = fixture(100);
  g.restaurants.noodle_nook.owned = false;
  expect(streetHonor(g, 'maple_street').multiplier).toBe(1);
  expect(honorMultiplier(g, 'river_grill')).toBe(1.5);
  g.neighborhood.unlockedStreets = ['maple_street'];
  expect(honorMultiplier(g, 'river_grill')).toBe(1);
  expect(honorMultiplier(g, 'unknown')).toBe(1);
  expect(streetHonor(g, 'unknown').multiplier).toBe(1);
});
it('applies once to normal registers, collection, managers, partial boost and offline', () => {
  const g = fixture(50);
  // Noodle: base 1 * level 50 * milestone 8 * rating 1.25 * honor 1.25.
  expect(income(g, 'noodle_nook', 0)).toBe(625);
  const tick = accrue(g, 0, 1000).data;
  expect(tick.restaurants.noodle_nook.register).toBe(625);
  expect(collect(tick, 'noodle_nook').coins).toBe(625);
  g.restaurants.noodle_nook.hasManager = true;
  g.boostUntil = 1000;
  expect(accrue(g, 0, 2000).data.coins).toBe(1875);
  expect(offlineIncome(g, 0, 2000)).toBe(937.5);
  expect(accrue(g, 0, 120000).data.restaurants.coffee_corner.register).toBe(
    income(g, 'coffee_corner', 120000) * 60,
  );
});
it('actual final upgrade earns honor without additional gems or currency rewards', () => {
  const g = fixture(50);
  g.restaurants.noodle_nook.level = 49;
  g.coins = upgradeCost('noodle_nook', 49);
  const other = income(g, 'river_grill', 0);
  const next = levelUp(g, 'noodle_nook');
  expect(next.coins).toBe(0);
  expect(next.gems).toBe(5);
  expect(income(next, 'noodle_nook', 0)).toBe(625);
  expect(income(next, 'river_grill', 0)).toBe(other);
});
it.each([1, 2, 3, 4])(
  'v%s high-level progress qualifies immediately and roundtrips unchanged',
  (version) => {
    const g = fixture(100);
    g.neighborhood.unlockedStreets = ['maple_street'];
    g.restaurants.river_grill = fresh().restaurants.river_grill;
    g.restaurants.market_gelato = fresh().restaurants.market_gelato;
    const wire = JSON.parse(serialize(g, 1000, 123));
    wire.version = version;
    if (version < 4) {
      delete wire.restaurants.river_grill;
      delete wire.restaurants.market_gelato;
    }
    if (version < 3) delete wire.neighborhood;
    const parsed = parseSave(JSON.stringify(wire))!;
    expect(parsed).not.toBeNull();
    expect(streetHonor(parsed, 'maple_street').multiplier).toBe(1.5);
    expect(parsed.restaurants).toEqual(g.restaurants);
    expect(parsed.coins).toBe(g.coins);
    expect(parsed.gems).toBe(g.gems);
    expect(parseSave(serialize(parsed, 1000, 123))).toEqual(parsed);
  },
);
