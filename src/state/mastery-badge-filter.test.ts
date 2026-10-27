import { expect, it } from 'vitest';
import { fresh } from './economy';
import { neighborhoods } from '../data/neighborhoods';
import { masteryBadgeFilter } from './mastery-badge-filter';
import { masteryOrder } from './mastery-order';
import { masterySearch } from './mastery-search';

const catalog = neighborhoods.flatMap((s) => s.restaurants);
it.each([
  [false, 0, 'Apprentice'],
  [false, 100, 'Apprentice'],
  [true, 24, 'Apprentice'],
  [true, 25, 'Artisan'],
  [true, 49, 'Artisan'],
  [true, 50, 'Master'],
  [true, 99, 'Master'],
  [true, 100, ''],
  [true, 1000, ''],
] as const)(
  'filters next unearned badge for owned=%s level=%s',
  (owned, level, next) => {
    const progress = fresh().restaurants;
    for (const r of catalog) Object.assign(progress[r.id], { owned, level });
    for (const badge of ['Apprentice', 'Artisan', 'Master'] as const) {
      expect(masteryBadgeFilter(progress, catalog, badge)).toEqual(
        badge === next ? catalog : [],
      );
    }
    expect(masteryBadgeFilter(progress, catalog, 'all')).toEqual(catalog);
  },
);
it('composes with search/order, preserves identities and never mutates inputs', () => {
  const progress = fresh().restaurants;
  [50, 99, 100, 49, 24, 0, 25, 100].forEach((level, i) =>
    Object.assign(progress[catalog[i].id], { owned: level > 0, level }),
  );
  Object.values(progress).forEach(Object.freeze);
  Object.freeze(progress);
  const input = Object.freeze([...catalog]);
  const before = structuredClone(progress);
  const result = masterySearch(
    masteryBadgeFilter(progress, masteryOrder(progress, input), 'Master'),
    ' o ',
  );
  expect(result).toEqual([catalog[1], catalog[0]]);
  expect(result[0]).toBe(catalog[1]);
  expect(result[1]).toBe(catalog[0]);
  expect(progress).toEqual(before);
  expect(input).toEqual(catalog);
  expect(masteryBadgeFilter(progress, [], 'Master')).toEqual([]);
});
