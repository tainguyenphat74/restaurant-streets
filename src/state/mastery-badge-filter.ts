import type { GameData } from './economy';
import { restaurantMastery } from './mastery';

export type MasteryBadgeFilter =
  'all' | Exclude<ReturnType<typeof restaurantMastery>['next'], ''>;

export function masteryBadgeFilter<T extends { id: string }>(
  progress: GameData['restaurants'],
  catalog: readonly T[],
  badge: MasteryBadgeFilter,
): T[] {
  return catalog.filter((restaurant) => {
    const { owned, level } = progress[restaurant.id];
    return badge === 'all' || restaurantMastery(owned, level).next === badge;
  });
}
