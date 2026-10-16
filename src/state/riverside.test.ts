import { expect, it } from 'vitest';
import { fresh } from './economy';
import {
  riversideCompleted,
  riversideLevel,
  riversideGoalIds,
} from './riverside';
import { useGame } from './store';

it('pins the six historical Maple goals and reports fresh progress', () => {
  expect(riversideGoalIds).toEqual([
    'noodle_nook',
    'coffee_corner',
    'sunny_bakery',
    'taco_tuesday',
    'tomato_basil',
    'sushi_station',
  ]);
  const data = fresh();
  expect(riversideCompleted(data)).toBe(0);
  expect(riversideLevel(data, 'noodle_nook')).toBe(1);
  expect(riversideLevel(data, 'coffee_corner')).toBe(0);
});
it('counts partial, exact and above-target ownership without mutating any state', () => {
  const data = fresh();
  for (const id of riversideGoalIds)
    Object.assign(data.restaurants[id], { owned: true, level: 25 });
  data.restaurants.noodle_nook.level = 24;
  expect(riversideCompleted(data)).toBe(5);
  data.restaurants.noodle_nook.level = 25;
  expect(riversideCompleted(data)).toBe(6);
  data.restaurants.noodle_nook.level = 1000;
  const before = structuredClone(data);
  expect(riversideCompleted(data)).toBe(6);
  expect(riversideLevel(data, 'noodle_nook')).toBe(1000);
  expect(data).toEqual(before);
  data.restaurants.noodle_nook.owned = false;
  expect(riversideCompleted(data)).toBe(5);
  expect(riversideLevel(data, 'noodle_nook')).toBe(0);
});
it('primitive selectors stay equal on register ticks and update on existing upgrades', () => {
  useGame.getState().restore({ ...fresh(), coins: 1e6 });
  const before = useGame.getState().data;
  useGame.getState().tick(1000, 2000);
  const after = useGame.getState().data;
  expect(after.restaurants.noodle_nook.register).toBeGreaterThan(
    before.restaurants.noodle_nook.register,
  );
  expect(riversideCompleted(after)).toBe(riversideCompleted(before));
  for (const id of riversideGoalIds)
    expect(riversideLevel(after, id)).toBe(riversideLevel(before, id));
  useGame.getState().act('upgrade', 'noodle_nook');
  expect(riversideLevel(useGame.getState().data, 'noodle_nook')).toBe(2);
});
