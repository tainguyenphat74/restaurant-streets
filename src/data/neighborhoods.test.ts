import { expect, it } from 'vitest';
import { neighborhoods } from './neighborhoods';
import { restaurants } from './restaurants';
import { fresh } from '../state/economy';
it('keeps only the unchanged Maple catalog active and Riverside empty', () => {
  expect(neighborhoods.map((n) => [n.id, n.active])).toEqual([
    ['maple_street', true],
    ['riverside_market', false],
  ]);
  expect(neighborhoods[0].restaurants).toBe(restaurants);
  expect(neighborhoods[1].restaurants).toEqual([]);
  expect(restaurants.map((r) => [r.id, r.baseCost, r.baseIncome])).toEqual([
    ['noodle_nook', 0, 1],
    ['coffee_corner', 100, 5],
    ['sunny_bakery', 1200, 40],
    ['taco_tuesday', 15000, 300],
    ['tomato_basil', 200000, 2500],
    ['sushi_station', 3000000, 25000],
  ]);
  expect(Object.keys(fresh().restaurants)).toEqual(
    restaurants.map((r) => r.id),
  );
});
