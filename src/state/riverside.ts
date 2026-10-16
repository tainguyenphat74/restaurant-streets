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

export function restaurantAvailable(data: GameData, id: string): boolean {
  return (
    riversideGoalIds.some((known) => known === id) ||
    (['river_grill', 'market_gelato'].includes(id) &&
      data.neighborhood.unlockedStreets.includes('riverside_market'))
  );
}
export function unlockRiverside(data: GameData): GameData {
  if (
    data.neighborhood.unlockedStreets.includes('riverside_market') ||
    riversideCompleted(data) !== 6
  )
    return data;
  return {
    ...data,
    neighborhood: {
      ...data.neighborhood,
      unlockedStreets: ['maple_street', 'riverside_market'],
    },
  };
}
export function switchStreet(
  data: GameData,
  street: import('./economy').StreetId,
): GameData {
  if (
    !data.neighborhood.unlockedStreets.includes(street) ||
    data.neighborhood.currentStreet === street
  )
    return data;
  return {
    ...data,
    neighborhood: { ...data.neighborhood, currentStreet: street },
  };
}
