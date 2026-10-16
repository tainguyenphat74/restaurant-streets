import { expect, it } from 'vitest';
import {
  fresh,
  levelUp,
  accrue,
  collect,
  hire,
  offlineIncome,
  income,
} from './economy';
import { unlockRiverside, switchStreet, riversideGoalIds } from './riverside';
import { parseSave, serialize } from './save';
import { buyLevels } from './bulk';
const ready = () => {
  const g = fresh();
  for (const id of riversideGoalIds)
    Object.assign(g.restaurants[id], { owned: true, level: 25 });
  return g;
};
it('freezes v1/v2/v3 IDs and Maple-only v3 before explicit v4 migration', () => {
  const g = ready();
  g.coins = 123.25;
  g.gems = 73;
  g.boostUntil = 601000;
  g.upgrades = ['ingredients'];
  g.restaurants.noodle_nook.register = 17.5;
  g.restaurants.noodle_nook.hasManager = true;
  for (const version of [1, 2, 3]) {
    const wire: any = {
      ...g,
      restaurants: Object.fromEntries(
        riversideGoalIds.map((id) => [id, g.restaurants[id]]),
      ),
      version,
      savedAt: 1000,
      pendingOffline: 81.25,
    };
    if (version < 3) delete wire.neighborhood;
    const migrated = parseSave(JSON.stringify(wire))!;
    expect(migrated).toEqual({
      ...g,
      version: 4,
      savedAt: 1000,
      pendingOffline: 81.25,
    });
    expect(
      parseSave(
        JSON.stringify({
          ...wire,
          restaurants: {
            ...wire.restaurants,
            river_grill: {
              owned: false,
              level: 0,
              hasManager: false,
              register: 0,
            },
          },
        }),
      ),
    ).toBeNull();
    expect(
      parseSave(
        JSON.stringify({
          ...wire,
          neighborhood: {
            currentStreet: 'riverside_market',
            unlockedStreets: ['maple_street', 'riverside_market'],
          },
        }),
      ),
    ).toBeNull();
  }
});
it('requires earned explicit idempotent unlock, and gates pure single/bulk purchases', () => {
  const g = { ...fresh(), coins: 1e12 };
  expect(unlockRiverside(g)).toBe(g);
  expect(levelUp(g, 'river_grill')).toBe(g);
  expect(buyLevels(g, 'river_grill', 'max')).toBe(g);
  expect(switchStreet(g, 'riverside_market')).toBe(g);
  const earned = ready(),
    unlocked = unlockRiverside(earned);
  expect(unlocked.coins).toBe(earned.coins);
  expect(unlockRiverside(unlocked)).toBe(unlocked);
  expect(
    switchStreet(unlocked, 'riverside_market').neighborhood.currentStreet,
  ).toBe('riverside_market');
});
it('both streets accrue, collect once, hire once, bulk and share boosts/global effects', () => {
  let g = { ...unlockRiverside(ready()), coins: 1e12 };
  for (const id of ['river_grill', 'market_gelato']) g = levelUp(g, id);
  g = buyLevels(g, 'river_grill', '10');
  expect(g.restaurants.river_grill.level).toBe(11);
  g = accrue(g, 1000, 2000).data;
  for (const id of ['noodle_nook', 'river_grill', 'market_gelato'])
    expect(g.restaurants[id].register).toBeGreaterThan(0);
  g = collect(g, 'river_grill');
  expect(collect(g, 'river_grill')).toEqual(g);
  g = hire(g, 'river_grill');
  expect(hire(g, 'river_grill')).toBe(g);
  expect(offlineIncome(g, 1000, 3000)).toBe(income(g, 'river_grill', 1000));
  expect(
    income(
      { ...g, upgrades: ['ingredients'], boostUntil: 600000 },
      'river_grill',
      1000,
    ),
  ).toBe(income(g, 'river_grill', 1000) * 4);
  expect(parseSave(serialize(g, 1000))).not.toBeNull();
});
it('rejects v4 locked ownership, unearned unlock and inconsistent current streets', () => {
  const g = fresh();
  for (const change of [
    {
      neighborhood: {
        currentStreet: 'riverside_market',
        unlockedStreets: ['maple_street'],
      },
    },
    {
      neighborhood: {
        currentStreet: 'maple_street',
        unlockedStreets: ['maple_street', 'riverside_market'],
      },
    },
    {
      restaurants: {
        ...g.restaurants,
        river_grill: { owned: true, level: 1, register: 0, hasManager: false },
      },
    },
  ])
    expect(parseSave(serialize({ ...g, ...change } as any, 1000))).toBeNull();
});

it('checkpoints combined street offline rewards and claims once after v4 reload', async () => {
  const { load, persist } = await import('./save');
  let g = {
    ...unlockRiverside(ready()),
    coins: 1e12,
    boostUntil: 6000,
    upgrades: ['ingredients', 'service'],
  };
  g = hire(g, 'noodle_nook');
  g = hire(levelUp(g, 'river_grill'), 'river_grill');
  let raw = '';
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
    },
    removeItem() {},
  };
  persist(g, 1000, 17, storage);
  const loaded = load(11000, storage);
  const expected =
    17 +
    (income({ ...g, boostUntil: 0 }, 'noodle_nook', 0) +
      income({ ...g, boostUntil: 0 }, 'river_grill', 0)) *
      7.5;
  expect(loaded.pending).toBe(expected);
  persist(loaded.data, 11000, loaded.pending, storage);
  expect(load(11000, storage).pending).toBe(expected);
  persist(
    { ...loaded.data, coins: loaded.data.coins + expected },
    11000,
    0,
    storage,
  );
  expect(load(11000, storage).pending).toBe(0);
  expect(load(11000, storage).data.coins).toBe(g.coins + expected);
});
