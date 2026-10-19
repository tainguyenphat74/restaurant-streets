import { expect, it } from 'vitest';
import { restaurantMastery } from './mastery';
import { fresh, income, levelUp, upgradeCost } from './economy';
import { restaurants } from '../data/restaurants';
import { parseSave, serialize } from './save';

it.each([
  [1, '', 'Apprentice', 25],
  [24, '', 'Apprentice', 25],
  [25, 'Apprentice', 'Artisan', 50],
  [26, 'Apprentice', 'Artisan', 50],
  [49, 'Apprentice', 'Artisan', 50],
  [50, 'Artisan', 'Master', 100],
  [51, 'Artisan', 'Master', 100],
  [99, 'Artisan', 'Master', 100],
  [100, 'Master', '', 0],
  [101, 'Master', '', 0],
  [1000, 'Master', '', 0],
])(
  'derives exactly one badge at owned level %s',
  (level, badge, next, target) => {
    expect(restaurantMastery(true, level)).toEqual({
      level,
      badge,
      next,
      target,
    });
  },
);
it.each([0, 1, 25, 50, 100, 1000])(
  'unowned level %s earns nothing',
  (level) => {
    expect(restaurantMastery(false, level)).toEqual({
      level: 0,
      badge: '',
      next: 'Apprentice',
      target: 25,
    });
  },
);
it('isolates every restaurant on both streets; repeated reads never write or reward', () => {
  const g = fresh();
  g.neighborhood.unlockedStreets.push('riverside_market');
  restaurants.forEach((c, i) =>
    Object.assign(g.restaurants[c.id], {
      owned: i % 4 !== 0,
      level: [0, 25, 50, 100][i % 4],
    }),
  );
  const before = serialize(g, 1000, 123);
  const rates = restaurants.map((c) => income(g, c.id, 1000));
  Object.freeze(g);
  Object.values(g.restaurants).forEach(Object.freeze);
  for (let n = 0; n < 3; n++)
    restaurants.forEach((c, i) => {
      const r = g.restaurants[c.id];
      expect(restaurantMastery(r.owned, r.level).badge).toBe(
        ['', 'Apprentice', 'Artisan', 'Master'][i % 4],
      );
    });
  expect(serialize(g, 1000, 123)).toBe(before);
  expect(restaurants.map((c) => income(g, c.id, 1000))).toEqual(rates);
});
it.each([25, 50, 100])(
  'real upgrade to %s retains only existing milestone rewards and cost',
  (target) => {
    const g = fresh();
    g.restaurants.noodle_nook.level = target - 1;
    g.coins = upgradeCost('noodle_nook', target - 1) + 17;
    const next = levelUp(g, 'noodle_nook');
    const before = structuredClone(next);
    const r = next.restaurants.noodle_nook;
    expect(restaurantMastery(r.owned, r.level).badge).toBe(
      { 25: 'Apprentice', 50: 'Artisan', 100: 'Master' }[target],
    );
    expect(next).toEqual({
      ...g,
      coins: 17,
      gems: g.gems + 5,
      restaurants: {
        ...g.restaurants,
        noodle_nook: { ...g.restaurants.noodle_nook, level: target },
      },
    });
    expect(next).toEqual(before);
  },
);
it.each([1, 2, 3, 4])(
  'v%s saves earn badges immediately without changing any saved field',
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
    const before = serialize(parsed, 1000, 234);
    for (const r of Object.values(parsed.restaurants))
      restaurantMastery(r.owned, r.level);
    expect(
      restaurantMastery(
        parsed.restaurants.noodle_nook.owned,
        parsed.restaurants.noodle_nook.level,
      ).badge,
    ).toBe('Master');
    expect(serialize(parsed, 1000, 234)).toBe(before);
    expect(parseSave(before)).toEqual(parsed);
  },
);
