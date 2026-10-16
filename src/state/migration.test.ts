import { expect, it } from 'vitest';
import { fresh, accrue, offlineIncome, totalIncome } from './economy';
import { migrateSave, parseSave, serialize, load } from './save';

function legacy() {
  const { neighborhood: _, ...data } = fresh();
  data.coins = 123456.789;
  data.gems = 87;
  data.boostUntil = 601000;
  data.upgrades = ['ingredients', 'service'];
  Object.values(data.restaurants).forEach((r, i) =>
    Object.assign(r, {
      owned: true,
      level: [1, 10, 25, 50, 100, 1000][i],
      hasManager: i % 2 === 0,
      register: i + 0.125,
    }),
  );
  return { ...data, version: 1, savedAt: 1000, pendingOffline: 456.789 };
}
it('explicitly migrates every v1 field without resetting progress or timestamps', () => {
  const v1 = legacy();
  const migrated = migrateSave(JSON.stringify(v1));
  expect(migrated).toEqual({
    ...v1,
    version: 3,
    neighborhood: fresh().neighborhood,
  });
  expect(parseSave(JSON.stringify(migrated))).toEqual(migrated);
  const { version, savedAt, pendingOffline, ...data } = v1;
  expect(
    JSON.parse(
      serialize(
        { ...data, neighborhood: fresh().neighborhood },
        savedAt,
        pendingOffline,
      ),
    ),
  ).toEqual(migrated);
  const loaded = load(2000, {
    getItem: () => JSON.stringify(v1),
    setItem() {},
    removeItem() {},
  });
  expect(loaded.data).toEqual({ ...data, neighborhood: fresh().neighborhood });
  expect(loaded.pending).toBe(
    pendingOffline +
      offlineIncome(
        { ...data, neighborhood: fresh().neighborhood },
        savedAt,
        2000,
      ),
  );
  expect(Number.isFinite(totalIncome(loaded.data, 2000))).toBe(true);
  expect(Number.isFinite(accrue(loaded.data, 2000, 3000).data.coins)).toBe(
    true,
  );
});
it('accepts legacy omitted pending only and rejects malformed schemas without fallback', () => {
  const v1 = legacy();
  const { pendingOffline, ...old } = v1;
  expect(migrateSave(JSON.stringify(old))).toEqual({
    ...old,
    version: 3,
    neighborhood: fresh().neighborhood,
    pendingOffline: 0,
  });
  for (const version of [undefined, null, 0, -1, 1.5, '1', 3, 999]) {
    expect(migrateSave(JSON.stringify({ ...v1, version }))).toBeNull();
  }
  for (const version of [1, 2]) {
    for (const restaurant of [
      [],
      null,
      { ...v1.restaurants.noodle_nook, mystery: 1 },
    ]) {
      expect(
        migrateSave(
          JSON.stringify({
            ...v1,
            version,
            restaurants: { ...v1.restaurants, noodle_nook: restaurant },
          }),
        ),
      ).toBeNull();
    }
    expect(
      migrateSave(
        JSON.stringify({
          ...v1,
          version,
          restaurants: {
            ...v1.restaurants,
            riverside: v1.restaurants.noodle_nook,
          },
        }),
      ),
    ).toBeNull();
  }
  expect(parseSave(JSON.stringify({ ...old, version: 2 }))).toBeNull();
  let raw = JSON.stringify({ ...v1, version: 99 });
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value;
    },
    removeItem() {},
  };
  expect(load(1000, storage).corrupt).toBe(true);
  expect(JSON.parse(storage.getItem()).version).toBe(99);
});

it('reports an empty stored save as corrupt rather than treating it as absent', () => {
  expect(
    load(1000, { getItem: () => '', setItem() {}, removeItem() {} }).corrupt,
  ).toBe(true);
});
