import { restaurants } from '../data/restaurants';
import { milestones, upgradeCost, type GameData } from './economy';

export type BuyMode = '1' | '10' | 'milestone' | 'max';
export const nextMilestone = (level: number) =>
  milestones.find((m) => m > level);

// Same per-level subtraction/rewards as levelUp, without allocating simulated
// game states. Partial purchases buy up to the affordable target, at most 1000.
function simulate(g: GameData, id: string, mode: BuyMode) {
  let count = 0,
    cost = 0,
    coins = g.coins,
    gems = g.gems;
  const config = restaurants.find((r) => r.id === id);
  const r = g.restaurants[id];
  if (
    !config ||
    !r ||
    !Number.isFinite(coins) ||
    coins < 0 ||
    !Number.isFinite(gems) ||
    gems < 0 ||
    !Number.isInteger(r.level) ||
    r.level < 0 ||
    r.level >= 1000
  ) {
    return { count, cost, coins, gems };
  }
  const limit = !r.owned
    ? 1
    : mode === '1'
      ? 1
      : mode === '10'
        ? 10
        : mode === 'milestone'
          ? (nextMilestone(r.level) ?? r.level) - r.level
          : mode === 'max'
            ? 1000 - r.level
            : 0;
  for (let i = 0; i < Math.min(limit, 1000 - r.level); i++) {
    const price =
      r.owned || count > 0 ? upgradeCost(id, r.level + count) : config.baseCost;
    if (coins < price) break;
    coins -= price;
    cost += price;
    count++;
    if (milestones.includes(r.level + count)) gems += 5;
  }
  return { count, cost, coins, gems };
}
export function quoteLevels(g: GameData, id: string, mode: BuyMode) {
  const { count, cost, gems } = simulate(g, id, mode);
  return { count, cost, gems: count ? gems - g.gems : 0 };
}
export function buyLevels(g: GameData, id: string, mode: BuyMode): GameData {
  const { count, coins, gems } = simulate(g, id, mode);
  if (!count) return g;
  const r = g.restaurants[id];
  return {
    ...g,
    coins,
    gems,
    restaurants: {
      ...g.restaurants,
      [id]: { ...r, owned: true, level: r.level + count },
    },
  };
}
