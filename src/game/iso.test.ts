import { expect, it } from 'vitest';
import { iso, screenToGrid } from './iso';
it.each([
  [0, 0],
  [4, 5],
  [-7, 10],
  [0.25, -3.75],
  [16, 16],
])('round trips grid coordinates %s, %s', (x, y) => {
  const screen = iso(x, y);
  expect(screenToGrid(screen.x, screen.y)).toEqual({ x, y });
});
it('round trips projected coordinates without rounding to a tile', () => {
  const grid = screenToGrid(137, -219);
  expect(iso(grid.x, grid.y)).toEqual({ x: 137, y: -219 });
});
