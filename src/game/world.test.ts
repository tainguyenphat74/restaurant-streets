import { describe, expect, it } from 'vitest';
import { decorationLayout, depthAt } from './world';
import { iso } from './iso';
describe('street depth and deterministic decoration placement', () => {
  it('sorts a walker by its isometric ground position', () => {
    expect(depthAt(iso(4, 5).y)).toBe(9);
    expect(depthAt(iso(11, 10).y)).toBe(21);
  });
  it('reproduces seeded scatter without putting trees on road or plots', () => {
    const a = decorationLayout(74);
    expect(a).toEqual(decorationLayout(74));
    expect(a).not.toEqual(decorationLayout(75));
    expect(a.filter((d) => d.key === 'tree')).toHaveLength(26);
    for (const d of a) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThan(14);
      if (d.key === 'tree') expect(d.y < 3 || d.y > 11).toBe(true);
      else expect([6, 9]).toContain(d.y);
    }
  });
});
