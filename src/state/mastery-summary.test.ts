import { expect, it } from 'vitest';
import { fresh } from './economy';
import { restaurants } from '../data/restaurants';
import { mapleRestaurants } from '../data/maple';
import { riversideRestaurants } from '../data/riverside';
import { masterySummary } from './mastery-summary';

it('counts cumulative earned badges, not just the current badge', () => {
  const data = fresh();
  [24, 25, 49, 50, 99, 100].forEach((level, i) => {
    Object.assign(data.restaurants[mapleRestaurants[i].id], {
      owned: true,
      level,
    });
  });
  expect(masterySummary(data.restaurants, mapleRestaurants)).toEqual({
    badges: 9,
    completed: 1,
    total: 6,
  });
});
it('keeps fresh, unowned and the two streets independent', () => {
  const data = fresh();
  expect(masterySummary(data.restaurants, mapleRestaurants)).toEqual({
    badges: 0,
    completed: 0,
    total: 6,
  });
  data.restaurants.river_grill.level = 100; // Unowned cannot earn badges.
  expect(masterySummary(data.restaurants, riversideRestaurants)).toEqual({
    badges: 0,
    completed: 0,
    total: 2,
  });
  data.restaurants.river_grill.owned = true;
  expect(masterySummary(data.restaurants, riversideRestaurants)).toEqual({
    badges: 3,
    completed: 1,
    total: 2,
  });
  expect(masterySummary(data.restaurants, mapleRestaurants).badges).toBe(0);
});
it('caps recognition at three per restaurant and never mutates progress', () => {
  const data = fresh();
  for (const r of Object.values(data.restaurants)) {
    Object.assign(r, {
      owned: true,
      level: 1000,
      register: 123,
      hasManager: true,
    });
    Object.freeze(r);
  }
  const before = structuredClone(data);
  for (let i = 0; i < 3; i++) {
    expect(masterySummary(data.restaurants, restaurants)).toEqual({
      badges: 24,
      completed: 8,
      total: 8,
    });
  }
  expect(data).toEqual(before);
  expect(masterySummary(data.restaurants, [])).toEqual({
    badges: 0,
    completed: 0,
    total: 0,
  });
});
