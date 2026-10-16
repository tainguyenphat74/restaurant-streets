import { fresh, type GameData, offlineIncome } from './economy';
// Historical wire schemas must not grow implicitly with the playable catalog.
const saveRestaurantIds = [
  'noodle_nook',
  'coffee_corner',
  'sunny_bakery',
  'taco_tuesday',
  'tomato_basil',
  'sushi_station',
] as const;
const saveUpgradeIds = ['ingredients', 'service'] as const;
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'restaurant-streets-save';
export type Save = GameData & {
  version: 2;
  savedAt: number;
  pendingOffline: number;
};
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const validNumber = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e100;
const validTimestamp = (n: unknown) =>
  validNumber(n) &&
  Number.isSafeInteger(n) &&
  (n as number) <= 8640000000000000;
export function migrateSave(json: string): Save | null {
  try {
    const v = JSON.parse(json);
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      Object.keys(v).some(
        (key) =>
          ![
            'version',
            'savedAt',
            'coins',
            'gems',
            'boostUntil',
            'restaurants',
            'upgrades',
            'pendingOffline',
          ].includes(key),
      ) ||
      (v.version !== 1 && v.version !== SAVE_VERSION) ||
      !validTimestamp(v.savedAt) ||
      !validNumber(v.coins) ||
      !validNumber(v.gems) ||
      !Number.isSafeInteger(v.gems) ||
      v.gems > 1000000 ||
      !validTimestamp(v.boostUntil) ||
      (v.boostUntil !== 0 && v.boostUntil > v.savedAt + 600000) ||
      !v.restaurants ||
      typeof v.restaurants !== 'object' ||
      Array.isArray(v.restaurants) ||
      Object.keys(v.restaurants).length !== saveRestaurantIds.length ||
      !Array.isArray(v.upgrades) ||
      new Set(v.upgrades).size !== v.upgrades.length ||
      !v.upgrades.every((id: unknown) =>
        saveUpgradeIds.some((known) => known === id),
      ) ||
      ((v.version === SAVE_VERSION || v.pendingOffline !== undefined) &&
        !validNumber(v.pendingOffline))
    )
      return null;
    for (const id of saveRestaurantIds) {
      const r = v.restaurants[id];
      if (
        !r ||
        typeof r !== 'object' ||
        Array.isArray(r) ||
        Object.keys(r).some(
          (key) => !['owned', 'level', 'hasManager', 'register'].includes(key),
        ) ||
        typeof r.owned !== 'boolean' ||
        typeof r.hasManager !== 'boolean' ||
        !Number.isInteger(r.level) ||
        r.level < 0 ||
        r.level > 1000 ||
        !validNumber(r.register) ||
        r.owned !== r.level > 0 ||
        (!r.owned && (r.hasManager || r.register !== 0))
      )
        return null;
    }
    if (!v.restaurants.noodle_nook.owned) return null;
    return {
      version: SAVE_VERSION,
      savedAt: v.savedAt,
      coins: v.coins,
      gems: v.gems,
      boostUntil: v.boostUntil,
      upgrades: [...v.upgrades],
      restaurants: Object.fromEntries(
        saveRestaurantIds.map((id) => {
          const r = v.restaurants[id];
          return [
            id,
            {
              owned: r.owned,
              level: r.level,
              hasManager: r.hasManager,
              register: r.register,
            },
          ];
        }),
      ),
      pendingOffline: v.pendingOffline ?? 0,
    };
  } catch {
    return null;
  }
}
// V1 → V2 preserves the flat Maple state, normalizing only legacy omitted pending.
// Both loading and import use this same validated migration boundary.
export const parseSave = migrateSave;
export function serialize(data: GameData, now: number, pendingOffline = 0) {
  return JSON.stringify({
    ...data,
    version: SAVE_VERSION,
    savedAt: now,
    pendingOffline,
  });
}
export function persist(
  data: GameData,
  now: number,
  pending: number,
  storage?: StorageLike,
) {
  try {
    (storage ?? window.localStorage).setItem(
      SAVE_KEY,
      serialize(data, now, pending),
    );
    return true;
  } catch {
    return false;
  }
}
export function load(
  now: number,
  storage?: StorageLike,
): { data: GameData; pending: number; blocked: boolean; corrupt: boolean } {
  try {
    const raw = (storage ?? window.localStorage).getItem(SAVE_KEY);
    if (raw === null)
      return { data: fresh(), pending: 0, blocked: false, corrupt: false };
    const saved = migrateSave(raw);
    if (!saved)
      return { data: fresh(), pending: 0, blocked: false, corrupt: true };
    const data: GameData = {
      coins: saved.coins,
      gems: saved.gems,
      restaurants: saved.restaurants,
      upgrades: saved.upgrades,
      boostUntil: saved.boostUntil,
    };
    return {
      data,
      pending:
        (saved.pendingOffline ?? 0) + offlineIncome(data, saved.savedAt, now),
      blocked: false,
      corrupt: false,
    };
  } catch {
    return { data: fresh(), pending: 0, blocked: true, corrupt: false };
  }
}
