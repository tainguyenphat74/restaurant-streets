import { restaurants } from '../data/restaurants';
import { levelUp, milestones, upgradeCost, type GameData } from './economy';

export type BuyMode = '1' | '10' | 'milestone' | 'max';
export const nextMilestone = (level: number) =>
  milestones.find((m) => m > level);

// Partial purchases: buy up to the requested target using sequential subtraction.
// Unowned plots always make exactly the original single purchase.
function simulate(g: GameData, id: string, mode: BuyMode) {
  let data = g,
    count = 0,
    cost = 0;
  const config = restaurants.find((r) => r.id === id);
  const r = g.restaurants[id];
  if (
    !config ||
    !r ||
    !Number.isFinite(g.coins) ||
    g.coins < 0 ||
    !Number.isFinite(g.gems) ||
    g.gems < 0 ||
    !Number.isInteger(r.level) ||
    r.level < 0 ||
    r.level >= 1000
  ) {
    return { data, count, cost, gems: 0 };
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
    const current = data.restaurants[id];
    const price = current.owned
      ? upgradeCost(id, current.level)
      : config.baseCost;
    const next = levelUp(data, id);
    if (next === data) break;
    cost += price;
    count++;
    data = next;
  }
  return { data, count, cost, gems: data.gems - g.gems };
}
export function quoteLevels(g: GameData, id: string, mode: BuyMode) {
  const { count, cost, gems } = simulate(g, id, mode);
  return { count, cost, gems };
}
export function buyLevels(g: GameData, id: string, mode: BuyMode): GameData {
  return simulate(g, id, mode).data;
}
