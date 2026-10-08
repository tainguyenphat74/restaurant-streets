export const iso = (x: number, y: number) => ({
  x: (x - y) * 64,
  y: (x + y) * 32,
});
export const plots = [
  { id: 'noodle_nook', x: 4, y: 5 },
  { id: 'coffee_corner', x: 7, y: 5 },
  { id: 'sunny_bakery', x: 10, y: 5 },
  { id: 'taco_tuesday', x: 5, y: 10 },
  { id: 'tomato_basil', x: 8, y: 10 },
  { id: 'sushi_station', x: 11, y: 10 },
];

// Inverse in projected world coordinates; undo camera pan/zoom first.
export const screenToGrid = (x: number, y: number) => ({
  x: x / 128 + y / 64,
  y: y / 64 - x / 128,
});
