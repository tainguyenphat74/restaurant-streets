// Cosmetic only. No store, clock, economy or persistence dependency.
// Ownership/levels retain achievements until an explicit reset or save import.
export function restaurantMastery(owned: boolean, ownedLevel: number) {
  const level = owned ? ownedLevel : 0;
  const badge =
    level >= 100
      ? 'Master'
      : level >= 50
        ? 'Artisan'
        : level >= 25
          ? 'Apprentice'
          : '';
  const target = level >= 100 ? 0 : level >= 50 ? 100 : level >= 25 ? 50 : 25;
  const next =
    target === 100
      ? 'Master'
      : target === 50
        ? 'Artisan'
        : target === 25
          ? 'Apprentice'
          : '';
  return { level, badge, next, target };
}
