import type { GameData } from './economy';

// Earned goal stays pinned to historical Maple, independent of future catalogs.
export const riversideGoalIds = [
  'noodle_nook',
  'coffee_corner',
  'sunny_bakery',
  'taco_tuesday',
  'tomato_basil',
  'sushi_station',
] as const;
export const riversideTarget = 25;

// Read validated state only; primitive results ignore register/clock changes.
export function riversideLevel(data: GameData, id: string): number {
  const restaurant = data.restaurants[id];
  return restaurant.owned ? restaurant.level : 0;
}
export function riversideCompleted(data: GameData): number {
  return riversideGoalIds.filter(
    (id) => riversideLevel(data, id) >= riversideTarget,
  ).length;
}
