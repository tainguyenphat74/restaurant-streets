import { expect, it } from 'vitest';
import { mapleRestaurants } from '../data/maple';
import { riversideRestaurants } from '../data/riverside';
import { masterySearch } from './mastery-search';

// Search only filters the supplied catalog; callers compose completion/order.
const catalog = [...mapleRestaurants, ...riversideRestaurants];
const names = (items: readonly { name: string }[]) => items.map((r) => r.name);
it('matches name substrings case-insensitively after trimming the query', () => {
  expect(names(masterySearch(catalog, '  cOfFeE  '))).toEqual([
    'Coffee Corner',
  ]);
  expect(names(masterySearch(catalog, '\t MARKET\n'))).toEqual([
    'Market Gelato',
  ]);
  expect(names(masterySearch(catalog, ' & '))).toEqual(['Tomato & Basil']);
  expect(names(masterySearch(catalog, 'oo'))).toEqual(['Noodle Nook']);
});
it('searches names only, never ids, street names, badges, or progress copy', () => {
  for (const query of [
    'noodle_nook',
    'Maple Street',
    'Riverside Market',
    'Master',
    'level',
    'Locked',
  ]) {
    expect(masterySearch(catalog, query)).toEqual([]);
  }
  const decoy = [
    { id: 'coffee', name: 'Tea', description: 'Coffee', street: 'Coffee' },
  ];
  expect(masterySearch(decoy, 'coffee')).toEqual([]);
});
it('keeps supplied order and item identity without mutating frozen inputs', () => {
  const input = Object.freeze(
    [...catalog].reverse().map((r) => Object.freeze({ ...r })),
  );
  const before = structuredClone(input);
  const expected = input.filter((r) => /a/i.test(r.name));
  for (let n = 0; n < 3; n++) {
    const result = masterySearch(input, ' A ');
    expect(result).toEqual(expected);
    result.forEach((r, i) => expect(r).toBe(expected[i]));
  }
  expect(input).toEqual(before);
  // Filtering an already ordered/filtered subset must not reintroduce rows.
  const subset = [catalog[5], catalog[1]];
  expect(masterySearch(subset, 'o')).toEqual(subset);
});
it('returns the usual catalog for empty/whitespace and handles no matches/empty input', () => {
  for (const query of ['', ' \t\n ']) {
    const result = masterySearch(catalog, query);
    expect(result).toEqual(catalog);
    result.forEach((r, i) => expect(r).toBe(catalog[i]));
  }
  expect(masterySearch(catalog, 'not a restaurant')).toEqual([]);
  expect(masterySearch([], 'coffee')).toEqual([]);
  expect(masterySearch([], '')).toEqual([]);
  expect(names(masterySearch(mapleRestaurants, 'market'))).toEqual([]);
  expect(names(masterySearch(riversideRestaurants, 'market'))).toEqual([
    'Market Gelato',
  ]);
});
