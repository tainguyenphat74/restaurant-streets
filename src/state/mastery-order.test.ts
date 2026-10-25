import { expect, it } from 'vitest';
import { fresh } from './economy';
import { mapleRestaurants } from '../data/maple';
import { riversideRestaurants } from '../data/riverside';
import { masteryOrder } from './mastery-order';

const ids = (catalog: readonly { id: string }[]) => catalog.map((r) => r.id);
function fixture(levels: number[]) {
  const data = fresh();
  levels.forEach((level, i) => {
    Object.assign(data.restaurants[mapleRestaurants[i].id], {
      owned: level > 0,
      level,
    });
  });
  return data.restaurants;
}
it('uses the next canonical target at every threshold with catalog-stable ties', () => {
  const progress = fixture([24, 25, 49, 50, 99, 100]);
  expect(ids(masteryOrder(progress, mapleRestaurants))).toEqual(
    [0, 2, 4, 1, 3, 5].map((i) => mapleRestaurants[i].id),
  );
});
it('puts owned unfinished before unowned before completed, retaining catalog order', () => {
  const progress = fixture([100, 0, 1000, 1, 0, 99]);
  // Ownership is authoritative even for an inconsistent pure-helper input.
  progress.coffee_corner.level = 100;
  expect(ids(masteryOrder(progress, mapleRestaurants))).toEqual(
    [5, 3, 1, 4, 0, 2].map((i) => mapleRestaurants[i].id),
  );
});
it('keeps equal remaining distances stable across different badges', () => {
  const progress = fixture([23, 48, 98, 24, 49, 99]);
  expect(ids(masteryOrder(progress, mapleRestaurants))).toEqual(
    [3, 4, 5, 0, 1, 2].map((i) => mapleRestaurants[i].id),
  );
});
it('does not mutate progress or catalog, retains item identities, and isolates streets', () => {
  const progress = fixture([100, 50, 25, 49, 99, 1000]);
  Object.assign(progress.market_gelato, { owned: true, level: 24 });
  Object.values(progress).forEach(Object.freeze);
  Object.freeze(progress);
  const catalog = Object.freeze([...mapleRestaurants]);
  const before = structuredClone(progress);
  const originalIds = ids(catalog);
  for (let n = 0; n < 3; n++) {
    const ordered = masteryOrder(progress, catalog);
    expect(ids(ordered)).toEqual([3, 4, 2, 1, 0, 5].map((i) => catalog[i].id));
    ordered.forEach((r) =>
      expect(r).toBe(catalog.find((item) => item.id === r.id)),
    );
    expect(ids(masteryOrder(progress, riversideRestaurants))).toEqual([
      'market_gelato',
      'river_grill',
    ]);
  }
  expect(progress).toEqual(before);
  expect(ids(catalog)).toEqual(originalIds);
  expect(masteryOrder(progress, [])).toEqual([]);
});
