import { afterEach, expect, it } from 'vitest';
import { buyLevels, quoteLevels } from './bulk';
import { fresh, levelUp, upgradeCost } from './economy';
import { useGame } from './store';

const original = useGame.getState();
afterEach(() => useGame.setState(original, true));
function fixture(id: string, level: number, coins: number) {
  const g = fresh();
  if (id === 'river_grill') {
    for (const r of Object.values(g.restaurants).slice(0, 6)) {
      r.owned = true;
      r.level = 25;
    }
    g.neighborhood.unlockedStreets.push('riverside_market');
    g.neighborhood.currentStreet = 'riverside_market';
  }
  Object.assign(g.restaurants[id], {
    owned: true,
    level,
    register: 17,
    hasManager: true,
  });
  Object.assign(g, {
    coins,
    gems: 13,
    boostUntil: 123456,
    upgrades: ['ingredients'],
  });
  return g;
}
for (const id of ['noodle_nook', 'river_grill']) {
  for (const [level, target] of [
    [1, 25],
    [9, 25],
    [24, 25],
    [25, 50],
    [49, 50],
    [50, 100],
    [99, 100],
    [100, 100],
    [1000, 1000],
  ]) {
    it(`${id} badge ${level} stops at ${target} with exact sequential state`, () => {
      for (const coins of [
        0,
        upgradeCost(id, level) * 0.99,
        upgradeCost(id, level),
        upgradeCost(id, level) * 2.2,
        1e30,
      ]) {
        const g = fixture(id, level, coins);
        const before = structuredClone(g);
        let expected = g;
        let cost = 0;
        for (let n = level; n < target; n++) {
          const next = levelUp(expected, id);
          if (next === expected) break;
          cost += upgradeCost(id, expected.restaurants[id].level);
          expected = next;
        }
        expect(quoteLevels(g, id, 'badge')).toEqual({
          count: expected.restaurants[id].level - level,
          cost,
          gems: expected.gems - g.gems,
        });
        expect(buyLevels(g, id, 'badge')).toEqual(expected);
        expect(g).toEqual(before);
        if (level >= 100) expect(buyLevels(g, id, 'badge')).toBe(g);
      }
    });
  }
}
it('crosses both 10 and 25 once; progresses to 50 and 100; other modes still work', () => {
  let g = fixture('noodle_nook', 9, 1e30);
  for (const [level, gems] of [
    [25, 23],
    [50, 28],
    [100, 33],
  ]) {
    g = buyLevels(g, 'noodle_nook', 'badge');
    expect(g.restaurants.noodle_nook.level).toBe(level);
    expect(g.gems).toBe(gems);
  }
  expect(buyLevels(g, 'noodle_nook', '1')).toEqual(levelUp(g, 'noodle_nook'));
});
it('buys unowned once and blocks locked streets', () => {
  const g = { ...fresh(), coins: 1e30 };
  expect(buyLevels(g, 'coffee_corner', 'badge')).toEqual(
    levelUp(g, 'coffee_corner'),
  );
  expect(buyLevels(g, 'river_grill', 'badge')).toBe(g);
  expect(quoteLevels(g, 'river_grill', 'badge')).toEqual({
    count: 0,
    cost: 0,
    gems: 0,
  });
  const unlocked = fixture('river_grill', 25, 1e30);
  expect(buyLevels(unlocked, 'market_gelato', 'badge')).toEqual(
    levelUp(unlocked, 'market_gelato'),
  );
});
it('transaction recalculates coins, level target and street availability after quotes', () => {
  const id = 'river_grill';
  const g = fixture(id, 24, 1e30);
  expect(quoteLevels(g, id, 'badge').count).toBe(1);
  for (const changed of [fixture(id, 25, 1e30), fixture(id, 24, 0), fresh()]) {
    useGame.setState({ data: changed, pending: 123 });
    useGame.getState().bulkUpgrade(id, 'badge');
    expect(useGame.getState().data).toEqual(buyLevels(changed, id, 'badge'));
    expect(useGame.getState().pending).toBe(123);
  }
});
