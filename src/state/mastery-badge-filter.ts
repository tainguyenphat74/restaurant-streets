import type { GameData } from './economy';
import type { restaurantMastery } from './mastery';

export type MasteryBadgeFilter =
  'all' | Exclude<ReturnType<typeof restaurantMastery>['next'], ''>;

export function masteryBadgeFilter<T extends { id: string }>(
  _progress: GameData['restaurants'],
  catalog: readonly T[],
  _badge: MasteryBadgeFilter,
): T[] {
  return [...catalog];
}
