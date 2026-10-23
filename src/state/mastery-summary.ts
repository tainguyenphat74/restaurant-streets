import type { GameData } from './economy';
import { restaurantMastery } from './mastery';

// Pure cumulative recognition from the existing badge derivation; no rewards.
export function masterySummary(
  progress: GameData['restaurants'],
  catalog: readonly { id: string }[],
) {
  let badges = 0;
  let completed = 0;
  for (const { id } of catalog) {
    const r = progress[id];
    const { badge } = restaurantMastery(r.owned, r.level);
    badges +=
      badge === 'Master'
        ? 3
        : badge === 'Artisan'
          ? 2
          : badge === 'Apprentice'
            ? 1
            : 0;
    if (badge === 'Master') completed++;
  }
  return { badges, completed, total: catalog.length };
}
