import { honorMultiplier } from './honors';
import { restaurantAvailable } from './riverside';
import { config, restaurants } from '../data/restaurants';
import { upgrades } from '../data/upgrades';
import { competitors } from '../data/competitors';
export type RestaurantState = {
  owned: boolean;
  level: number;
  hasManager: boolean;
  register: number;
};
// Only playable street IDs belong here; expand with a versioned save migration.
export type StreetId = 'maple_street' | 'riverside_market';
export type NeighborhoodState = {
  currentStreet: StreetId;
  unlockedStreets: StreetId[];
};
export type GameData = {
  neighborhood: NeighborhoodState;
  coins: number;
  gems: number;
  restaurants: Record<string, RestaurantState>;
  upgrades: string[];
  boostUntil: number;
};
export const milestones = [10, 25, 50, 100];
export const fresh = (): GameData => ({
  neighborhood: {
    currentStreet: 'maple_street',
    unlockedStreets: ['maple_street'],
  },
  coins: 0,
  gems: 0,
  restaurants: Object.fromEntries(
    restaurants.map((r, i) => [
      r.id,
      {
        owned: i === 0,
        level: i === 0 ? 1 : 0,
        hasManager: false,
        register: 0,
      },
    ]),
  ),
  upgrades: [],
  boostUntil: 0,
});
export const upgradeCost = (id: string, level: number) =>
  (config(id).baseCost || 10) * 1.15 ** level;
export const rating = (level: number) => Math.min(5, 3.5 + level * 0.05);
export const globalMultiplier = (g: GameData) =>
  upgrades.reduce(
    (n, u) => n * (g.upgrades.includes(u.id) ? u.multiplier : 1),
    1,
  );
export function income(g: GameData, id: string, now: number) {
  const r = g.restaurants[id];
  return r.owned
    ? config(id).baseIncome *
        r.level *
        2 ** milestones.filter((m) => r.level >= m).length *
        globalMultiplier(g) *
        (rating(r.level) / 4) *
        (g.boostUntil > now ? 2 : 1) *
        honorMultiplier(g, id)
    : 0;
}
export const totalIncome = (g: GameData, now: number) =>
  restaurants.reduce((n, r) => n + income(g, r.id, now), 0);
export const managerCost = (id: string) => config(id).baseCost * 10 || 500;
export const customers = (revenue: number, id: string) =>
  Math.floor(revenue / (config(id).baseIncome * 5));
export function netWorth(g: GameData) {
  return (
    g.coins +
    restaurants.reduce((n, c) => {
      const r = g.restaurants[c.id];
      return (
        n +
        r.register +
        (r.owned
          ? c.baseCost +
            ((c.baseCost || 10) * (1.15 ** r.level - 1.15)) / 0.15 +
            (r.hasManager ? managerCost(c.id) : 0)
          : 0)
      );
    }, 0) +
    upgrades.reduce((n, u) => n + (g.upgrades.includes(u.id) ? u.cost : 0), 0)
  );
}
export function rankings(g: GameData, now: number) {
  return rankingsForWorth(netWorth(g), now);
}
export function rankingsForWorth(worth: number, now: number) {
  return [
    ...competitors.map((c) => ({
      name: c.name,
      worth:
        c.base *
        (1 + c.growth * Math.max(0, (now - Date.UTC(2026, 0, 1)) / 1000)),
      player: false,
    })),
    { name: 'Your Maple Street', worth, player: true },
  ].sort((a, b) => b.worth - a.worth);
}
export function integratedIncome(
  g: GameData,
  id: string,
  start: number,
  end: number,
) {
  const seconds = Math.max(0, end - start) / 1000;
  const base = income({ ...g, boostUntil: 0 }, id, end);
  return (
    base * (seconds + Math.max(0, Math.min(end, g.boostUntil) - start) / 1000)
  );
}
export function offlineIncome(g: GameData, start: number, end: number) {
  const finish = Math.max(start, Math.min(end, start + 8 * 3600000));
  return restaurants.reduce(
    (n, r) =>
      n +
      (g.restaurants[r.id].hasManager
        ? integratedIncome(g, r.id, start, finish) * 0.5
        : 0),
    0,
  );
}
export function accrue(g: GameData, start: number, end: number) {
  let coins = g.coins;
  const revenue: Record<string, number> = {};
  const next = { ...g.restaurants };
  for (const c of restaurants) {
    const r = g.restaurants[c.id];
    if (!r.owned) continue;
    const earned = integratedIncome(g, c.id, start, end);
    const stored = Math.min(income(g, c.id, end) * 60, r.register + earned);
    revenue[c.id] = r.hasManager ? earned : Math.max(0, stored - r.register);
    if (r.hasManager) {
      coins += r.register + earned;
      next[c.id] = { ...r, register: 0 };
    } else next[c.id] = { ...r, register: stored };
  }
  return { data: { ...g, coins, restaurants: next }, revenue };
}
export function collect(g: GameData, id: string): GameData {
  const r = g.restaurants[id];
  return {
    ...g,
    coins: g.coins + r.register,
    restaurants: { ...g.restaurants, [id]: { ...r, register: 0 } },
  };
}
export function levelUp(g: GameData, id: string): GameData {
  if (!restaurantAvailable(g, id)) return g;
  const r = g.restaurants[id],
    cost = r.owned ? upgradeCost(id, r.level) : config(id).baseCost;
  if (g.coins < cost || r.level >= 1000) return g;
  const level = r.level + 1;
  return {
    ...g,
    coins: g.coins - cost,
    gems: g.gems + (milestones.includes(level) ? 5 : 0),
    restaurants: { ...g.restaurants, [id]: { ...r, owned: true, level } },
  };
}
export function hire(g: GameData, id: string): GameData {
  const r = g.restaurants[id],
    cost = managerCost(id);
  return !r.owned || r.hasManager || g.coins < cost
    ? g
    : {
        ...g,
        coins: g.coins - cost,
        restaurants: { ...g.restaurants, [id]: { ...r, hasManager: true } },
      };
}
export function purchaseUpgrade(g: GameData, id: string): GameData {
  const u = upgrades.find((u) => u.id === id);
  return !u || g.upgrades.includes(id) || g.coins < u.cost
    ? g
    : { ...g, coins: g.coins - u.cost, upgrades: [...g.upgrades, id] };
}
export const buyBoost = (g: GameData, now: number): GameData =>
  g.gems < 10 || g.boostUntil > now
    ? g
    : { ...g, gems: g.gems - 10, boostUntil: now + 600000 };
