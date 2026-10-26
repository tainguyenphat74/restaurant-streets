import { expect, it } from 'vitest';
import {
  fresh,
  income,
  accrue,
  integratedIncome,
  offlineIncome,
} from './economy';
import { serialize, parseSave } from './save';

it.each([
  [75, 937.5],
  [76, 965.2],
  [90, 1395],
  [100, 3850],
  [101, 3888.5],
  [1000, 38500],
])(
  'adds the bounded tail exactly once at level %s without changing save inputs',
  (level, rate) => {
    const g = fresh();
    Object.assign(g.restaurants.noodle_nook, { level, register: 7 });
    const before = structuredClone(g);
    const wire = serialize(g, 1000, 234);
    expect(income(g, 'noodle_nook', 0)).toBeCloseTo(rate, 8);
    expect(
      accrue(g, 0, 2000).data.restaurants.noodle_nook.register,
    ).toBeCloseTo(7 + rate * 2, 8);
    g.restaurants.noodle_nook.hasManager = true;
    g.boostUntil = 1000;
    expect(integratedIncome(g, 'noodle_nook', 0, 2000)).toBeCloseTo(
      rate * 3,
      8,
    );
    expect(offlineIncome(g, 0, 2000)).toBeCloseTo(rate * 1.5, 8);
    expect(accrue(g, 0, 2000).data.coins).toBeCloseTo(7 + rate * 3, 8);
    g.restaurants.noodle_nook.hasManager = false;
    g.boostUntil = 0;
    expect(g).toEqual(before);
    expect(serialize(g, 1000, 234)).toBe(wire);
    expect(parseSave(wire)).toEqual({
      ...before,
      version: 4,
      savedAt: 1000,
      pendingOffline: 234,
    });
  },
);
it('preserves the exact original canonical income through level 75', () => {
  const g = fresh();
  for (let level = 1; level <= 75; level++) {
    g.restaurants.noodle_nook.level = level;
    const milestone = level >= 50 ? 8 : level >= 25 ? 4 : level >= 10 ? 2 : 1;
    const expected =
      level *
      milestone *
      (Math.min(5, 3.5 + level * 0.05) / 4) *
      (1 + Math.max(0, level - 50) / 100);
    expect(income(g, 'noodle_nook', 0)).toBe(expected);
  }
});
