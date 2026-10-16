import { expect, it } from 'vitest';
import { neighborhoods } from './neighborhoods';
import { restaurants } from './restaurants';
import { mapleRestaurants } from './maple';
import { fresh } from '../state/economy';
it('preserves Maple tuning and adds exactly two locked Riverside restaurants', () => {
  expect(neighborhoods.map((n) => [n.id, n.active])).toEqual([
    ['maple_street', true],
    ['riverside_market', true],
  ]);
  expect(neighborhoods[0].restaurants).toBe(mapleRestaurants);
  expect(neighborhoods[1].restaurants.map((r) => r.id)).toEqual([
    'river_grill',
    'market_gelato',
  ]);
  expect(fresh().neighborhood.unlockedStreets).toEqual(['maple_street']);
  expect(mapleRestaurants.map((r) => [r.id, r.baseCost, r.baseIncome])).toEqual(
    [
      ['noodle_nook', 0, 1],
      ['coffee_corner', 100, 5],
      ['sunny_bakery', 1200, 40],
      ['taco_tuesday', 15000, 300],
      ['tomato_basil', 200000, 2500],
      ['sushi_station', 3000000, 25000],
    ],
  );
  expect(Object.keys(fresh().restaurants)).toEqual(
    restaurants.map((r) => r.id),
  );
});
