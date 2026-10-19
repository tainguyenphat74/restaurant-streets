import { neighborhoods } from '../data/neighborhoods';
import type { GameData } from './economy';

// Catalog + type-only dependency: no economy/riverside runtime cycle or save writes.
export function streetHonor(data: GameData, streetId: string) {
  const street = neighborhoods.find((s) => s.id === streetId);
  const unlocked =
    !!street && data.neighborhood.unlockedStreets.includes(street.id);
  let owned = 0,
    at50 = 0,
    at100 = 0;
  for (const c of street?.restaurants ?? []) {
    const r = data.restaurants[c.id];
    if (!r?.owned) continue;
    owned++;
    if (r.level >= 50) at50++;
    if (r.level >= 100) at100++;
  }
  const total = street?.restaurants.length ?? 0;
  const multiplier =
    !unlocked || !total ? 1 : at100 === total ? 1.5 : at50 === total ? 1.25 : 1;
  const target = multiplier === 1.5 ? 0 : multiplier === 1.25 ? 100 : 50;
  const nextId =
    unlocked && target
      ? (street?.restaurants.find(
          (c) =>
            !data.restaurants[c.id]?.owned ||
            data.restaurants[c.id].level < target,
        )?.id ?? '')
      : '';
  return { unlocked, owned, at50, at100, total, multiplier, target, nextId };
}
export function honorMultiplier(data: GameData, restaurantId: string): number {
  const street = neighborhoods.find((s) =>
    s.restaurants.some((c) => c.id === restaurantId),
  );
  return street ? streetHonor(data, street.id).multiplier : 1;
}
