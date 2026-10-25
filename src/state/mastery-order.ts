import type { GameData } from './economy';
import { restaurantMastery } from './mastery';

// Rank only the supplied street; retain catalog objects and stable tie order.
export function masteryOrder<T extends { id: string }>(
  progress: GameData['restaurants'],
  catalog: readonly T[],
): T[] {
  return catalog
    .map((restaurant, index) => {
      const { owned, level } = progress[restaurant.id];
      const mastery = restaurantMastery(owned, level);
      const group = !owned ? 1 : mastery.target === 0 ? 2 : 0;
      return {
        restaurant,
        index,
        group,
        remaining: group === 0 ? mastery.target - mastery.level : 0,
      };
    })
    .sort(
      (a, b) =>
        a.group - b.group || a.remaining - b.remaining || a.index - b.index,
    )
    .map(({ restaurant }) => restaurant);
}
