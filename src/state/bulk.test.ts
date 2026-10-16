import { expect, it } from 'vitest';
import { fresh, levelUp, upgradeCost, type GameData } from './economy';
import { buyLevels, quoteLevels, type BuyMode } from './bulk';

const id = 'noodle_nook';
function sequential(g: GameData, count: number) {
  for (let i = 0; i < count; i++) g = levelUp(g, id);
  return g;
}
for (const [mode, limit] of [
  ['1', 1],
  ['10', 10],
  ['milestone', 9],
  ['max', 999],
] as const) {
  it(`${mode} matches sequential purchases across balances`, () => {
    for (const coins of [0, 11.49, 11.5, 25, 100, 1e9, 1e100]) {
      const g = { ...fresh(), coins };
      const expected = sequential(g, limit);
      const quote = quoteLevels(g, id, mode);
      expect(buyLevels(g, id, mode)).toEqual(expected);
      expect(quote.count).toBe(expected.restaurants[id].level - 1);
      expect(quote.gems).toBe(expected.gems);
      expect(quote.cost).toBe(
        Array.from({ length: quote.count }, (_, i) =>
          upgradeCost(id, i + 1),
        ).reduce((a, b) => a + b, 0),
      );
      expect(expected.coins).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(expected.coins)).toBe(true);
      expect(g.restaurants[id].level).toBe(1);
    }
  });
}
it('stops at each existing milestone, then completes safely', () => {
  let g = { ...fresh(), coins: 1e100 };
  for (const level of [10, 25, 50, 100]) {
    g = buyLevels(g, id, 'milestone');
    expect(g.restaurants[id].level).toBe(level);
  }
  expect(g.gems).toBe(20);
  expect(buyLevels(g, id, 'milestone')).toBe(g);
  expect(quoteLevels(g, id, 'milestone').count).toBe(0);
  const capped = buyLevels(g, id, 'max');
  expect(capped.restaurants[id].level).toBe(1000);
  expect(capped.gems).toBe(20);
  expect(buyLevels(capped, id, 'max')).toBe(capped);
});
it('handles 999, exact balances, insufficient funds and every mode at cap', () => {
  const g = fresh();
  g.restaurants[id].level = 999;
  g.coins = upgradeCost(id, 999);
  const bought = buyLevels(g, id, '10');
  expect(bought).toEqual(levelUp(g, id));
  expect(bought.coins).toBe(0);
  for (const mode of ['1', '10', 'milestone', 'max'] as BuyMode[]) {
    expect(buyLevels(bought, id, mode)).toBe(bought);
  }
  g.coins *= 0.99;
  expect(buyLevels(g, id, 'max')).toBe(g);
});
it('keeps unowned purchases single and rejects unknown ids or invalid balances', () => {
  const g = { ...fresh(), coins: 1e6 };
  for (const mode of ['1', '10', 'milestone', 'max'] as BuyMode[]) {
    expect(buyLevels(g, 'coffee_corner', mode)).toEqual(
      levelUp(g, 'coffee_corner'),
    );
    expect(buyLevels(g, 'missing', mode)).toBe(g);
    expect(buyLevels(g, '__proto__', mode)).toBe(g);
  }
  for (const coins of [NaN, Infinity, -1]) {
    const invalid = { ...g, coins };
    expect(buyLevels(invalid, id, 'max')).toBe(invalid);
  }
});
