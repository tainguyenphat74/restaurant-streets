import { iso, plots } from './iso';
export type Point = { x: number; y: number };
export type Phase = 'stroll' | 'approach' | 'queue' | 'dine' | 'leave';
export type Customer = Point & {
  side: 6 | 9;
  phase: Phase;
  route: Point[];
  destination?: string;
  remaining: number;
  visits: number;
  exits: number;
  rounds: number;
};
export const population = (income: number) =>
  Math.min(
    20,
    Math.max(0, 10 + Math.floor(Math.log10(1 + Math.max(0, income)) * 2)),
  );
// Texture-space thresholds (200 x 230, bottom-center origin). Lower shops
// have a side porch at the left silhouette, accessible around the end wall.
export function entrance(id: string) {
  const p = plots.find((p) => p.id === id)!;
  const ground = iso(p.x, p.y);
  const side = p.y === 5 ? 6 : 9;
  const door = {
    x: ground.x + (side === 6 ? -22 : -84),
    y: ground.y + (side === 6 ? -19 : -50),
  };
  const waypoint = iso(side === 6 ? p.x - 0.47 : p.x - 1.6, side);
  const corner = side === 6 ? door : iso(p.x - 1.6, p.y - 0.125);
  return { side, door, waypoint, corner };
}
export function createCustomer(index: number): Customer {
  const side = index % 2 ? 9 : 6;
  return {
    ...iso(2 + (index % 10), side),
    side,
    phase: 'stroll',
    route: [iso(3 + (index % 9), side)],
    remaining: 0,
    visits: 0,
    exits: 0,
    rounds: index,
  };
}
export function advanceCustomer(
  c: Customer,
  seconds: number,
  owned: readonly string[],
) {
  const dt = Math.min(Math.max(seconds, 0), 0.1);
  if (c.destination && !owned.includes(c.destination)) {
    const e = entrance(c.destination);
    // Before reaching the corner, return directly to the sidewalk rather
    // than cutting toward the door of a shop that is no longer owned.
    c.route = c.phase === 'approach' && c.route.length >= 2
      ? [e.waypoint]
      : [e.corner, e.waypoint];
    c.phase = 'leave';
    c.destination = undefined;
  }
  if (c.route.length) {
    const target = c.route[0],
      dx = target.x - c.x,
      dy = target.y - c.y;
    const distance = Math.hypot(dx, dy),
      step = dt * 48;
    if (distance <= step) {
      c.x = target.x;
      c.y = target.y;
      c.route.shift();
    } else {
      c.x += (dx / distance) * step;
      c.y += (dy / distance) * step;
    }
    return;
  }
  c.remaining -= dt;
  if (c.remaining > 0) return;
  if (c.phase === 'stroll') {
    const choices = plots.filter(
      (p) => owned.includes(p.id) && entrance(p.id).side === c.side,
    );
    const next = choices[c.rounds++ % choices.length];
    if (next) {
      const e = entrance(next.id);
      c.destination = next.id;
      c.phase = 'approach';
      c.route = [e.waypoint, e.corner, e.door];
    } else c.route = [iso(2 + (c.rounds % 10), c.side)];
  } else if (c.phase === 'approach') {
    c.phase = 'queue';
    c.remaining = 0.8 + (c.rounds % 3) * 0.4;
  } else if (c.phase === 'queue') {
    c.phase = 'dine';
    c.remaining = 3 + (c.rounds % 3);
    c.visits++;
  } else if (c.phase === 'dine') {
    const e = entrance(c.destination!);
    c.phase = 'leave';
    c.route = [e.corner, e.waypoint];
  } else {
    c.exits++;
    c.phase = 'stroll';
    c.destination = undefined;
    c.route = [iso(2 + (c.rounds % 10), c.side)];
  }
}
