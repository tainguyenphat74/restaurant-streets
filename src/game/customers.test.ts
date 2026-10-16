import { describe, expect, it } from 'vitest';
import {
  advanceCustomer,
  createCustomer,
  entrance,
  population,
} from './customers';
import { plots, screenToGrid } from './iso';
describe('ambient customers', () => {
  it('caps population independently of gameplay', () => {
    expect(population(0)).toBe(10);
    expect(population(1e100)).toBe(20);
  });
  it('never selects locked or opposite-side shops', () => {
    for (let i = 0; i < 20; i++) {
      const c = createCustomer(i);
      for (let t = 0; t < 3000; t++) {
        advanceCustomer(c, 0.1, ['noodle_nook']);
        if (c.destination) {
          expect(c.destination).toBe('noodle_nook');
          expect(c.side).toBe(6);
        }
        if (c.side === 9) expect(screenToGrid(c.x, c.y).y).toBeCloseTo(9);
      }
    }
  });
  it.each(plots)('completes approach, queue, dining and exit for $id', (p) => {
    const c = createCustomer(p.y === 5 ? 0 : 1),
      phases = new Set<string>();
    for (let t = 0; t < 3000; t++) {
      advanceCustomer(c, 0.1, [p.id]);
      phases.add(c.phase);
      if (c.phase === 'queue' || c.phase === 'dine') {
        expect(c.x).toBe(entrance(p.id).door.x);
        expect(c.y).toBe(entrance(p.id).door.y);
      }
    }
    expect([...phases].sort()).toEqual([
      'approach',
      'dine',
      'leave',
      'queue',
      'stroll',
    ]);
    expect(c.visits).toBeGreaterThan(0);
    expect(c.exits).toBeGreaterThan(0);
    expect(entrance(p.id).side).toBe(p.y === 5 ? 6 : 9);
  });
  it('abandons a destination removed by save import', () => {
    const c = createCustomer(0);
    c.route = [];
    advanceCustomer(c, 0.1, ['noodle_nook']);
    advanceCustomer(c, 0.1, []);
    expect(c.destination).toBeUndefined();
    expect(c.phase).toBe('leave');
  });
});

it.each(plots)('returns to the sidewalk when $id is removed during approach', (p) => {
  const c = createCustomer(p.y === 5 ? 0 : 1);
  c.route = [];
  advanceCustomer(c, 0.1, [p.id]);
  advanceCustomer(c, 0.1, []);
  expect(c.route).toEqual([entrance(p.id).waypoint]);
  expect(c.destination).toBeUndefined();
});
