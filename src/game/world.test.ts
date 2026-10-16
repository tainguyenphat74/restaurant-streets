import { describe, expect, it } from 'vitest';
import { buildingDepth, decorationLayout, depthAt } from './world';
import { iso, plots } from './iso';
import { entrance } from './customers';
describe('street depth and deterministic decoration placement', () => {
  it.each(plots)(
    'sorts doorway customers in front of $id while retaining ground sorting',
    (plot) => {
      const ground = iso(plot.x, plot.y);
      const { door } = entrance(plot.id);
      const building = buildingDepth(ground.y, door.y);
      // Queue and newly leaving customers share the doorway ground position.
      expect(depthAt(door.y)).toBeGreaterThan(building);
      expect(depthAt(ground.y - 90)).toBeLessThan(building);
      expect(depthAt(ground.y)).toBeGreaterThan(building);
    },
  );
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

it('transforms doorway routing with external building anchors and scale on both streets', () => {
  for (const id of ['noodle_nook', 'sushi_station', 'river_grill', 'market_gelato']) {
    const plot = plots.find(p => p.id === id)!;
    const ground = iso(plot.x, plot.y);
    const defaults = entrance(id);
    const art = { anchorX: 0.25, anchorY: 0.75, scale: 0.8, width: 200, height: 230 };
    const transformed = entrance(id, art);
    expect(transformed.door.x).toBeCloseTo(ground.x + (defaults.door.x - ground.x + 50) * 0.8);
    expect(transformed.door.y).toBeCloseTo(ground.y + (defaults.door.y - ground.y + 57.5) * 0.8);
    expect(depthAt(transformed.door.y)).toBeGreaterThan(buildingDepth(ground.y, transformed.door.y));
  }
});
