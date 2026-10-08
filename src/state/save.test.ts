import { it, expect } from 'vitest';
import {
  load,
  persist,
  serialize,
  parseSave,
  SAVE_KEY,
  type StorageLike,
} from './save';
import { fresh } from './economy';
function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
}
it('restores exact registers levels and currencies', () => {
  const g = fresh();
  g.coins = 12.123;
  g.restaurants.noodle_nook.register = 9.876;
  const s = memory();
  persist(g, 1000, 0, s);
  expect(load(2000, s).data).toEqual(g);
  expect(load(2000, s).pending).toBe(0);
});
it('rejects corrupt schemas and unsupported saves', () => {
  expect(parseSave('oops')).toBeNull();
  for (const change of [
    { version: 2 },
    { coins: -1 },
    { coins: Infinity },
    { gems: 0.5 },
    { upgrades: ['fake'] },
    { restaurants: {} },
    { boostUntil: 'hi' },
  ])
    expect(
      parseSave(
        JSON.stringify({ ...JSON.parse(serialize(fresh(), 0)), ...change }),
      ),
    ).toBeNull();
  const s = memory();
  s.setItem(SAVE_KEY, '{');
  expect(load(0, s).corrupt).toBe(true);
});
it('catches blocked storage', () => {
  const s: StorageLike = {
    getItem: () => {
      throw Error();
    },
    setItem: () => {
      throw Error();
    },
    removeItem: () => {
      throw Error();
    },
  };
  expect(load(0, s).blocked).toBe(true);
  expect(persist(fresh(), 0, 0, s)).toBe(false);
});
it('checkpoints pending awards without duplicating them on reload or claim', () => {
  const s = memory(),
    g = fresh();
  g.restaurants.noodle_nook.hasManager = true;
  persist(g, 0, 0, s);
  const first = load(10000, s);
  persist(first.data, 10000, first.pending, s);
  expect(load(10000, s).pending).toBe(first.pending);
  const claimed = { ...first.data, coins: first.data.coins + first.pending };
  persist(claimed, 10000, 0, s);
  expect(load(10000, s).pending).toBe(0);
  expect(load(10000, s).data.coins).toBe(first.pending);
});
it('rejects invalid ownership, ids, registers, duplicate upgrades and nonfinite numbers', () => {
  for (const change of [
    { level: 1001 },
    { level: 1.5 },
    { owned: false },
    { hasManager: 'yes' },
    { register: -1 },
    { register: Infinity },
  ]) {
    const g = fresh();
    Object.assign(g.restaurants.noodle_nook, change);
    expect(parseSave(serialize(g, 0))).toBeNull();
  }
  for (const change of [{ hasManager: true }, { register: 1 }, { level: 1 }]) {
    const g = fresh();
    Object.assign(g.restaurants.coffee_corner, change);
    expect(parseSave(serialize(g, 0))).toBeNull();
  }
  const g = fresh();
  g.upgrades = ['ingredients', 'ingredients'];
  expect(parseSave(serialize(g, 0))).toBeNull();
  expect(parseSave(serialize(fresh(), NaN))).toBeNull();
  expect(parseSave(serialize(fresh(), 0, -1))).toBeNull();
});

it('rejects outrageous amounts, timestamps, boosts and unknown root state', () => {
  const base = JSON.parse(serialize(fresh(), 1000));
  for (const change of [
    { coins: Number.MAX_VALUE },
    { pendingOffline: Number.MAX_VALUE },
    { coins: 1.01e100 },
    { pendingOffline: 1.01e100 },
    { gems: 1000001 },
    { gems: Number.MAX_SAFE_INTEGER },
    { savedAt: -1 },
    { savedAt: 0.5 },
    { savedAt: 8640000000000001 },
    { boostUntil: Number.MAX_VALUE },
    { boostUntil: 601001 },
    { boostUntil: 0.5 },
    { selected: 'noodle_nook' },
  ])
    expect(parseSave(JSON.stringify({ ...base, ...change }))).toBeNull();
  const g = fresh();
  g.restaurants.noodle_nook.register = Number.MAX_VALUE;
  expect(parseSave(serialize(g, 0))).toBeNull();
  g.restaurants.noodle_nook.register = 1e100;
  g.coins = 1e100;
  g.gems = 1000000;
  g.boostUntil = 600000;
  expect(parseSave(serialize(g, 0, 1e100))).not.toBeNull();
  expect(parseSave(serialize(fresh(), 8640000000000000))).not.toBeNull();
});
