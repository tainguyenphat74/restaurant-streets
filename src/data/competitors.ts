export const competitors = [
  'Olive & Co.',
  'The Hungry Fox',
  'Peach Avenue',
  'Little Spoon',
  'Clover Kitchens',
  'Golden Fork',
  'Bistro Bloom',
  'The Supper Club',
  'Cedar Collective',
].map((name, i) => ({
  name,
  base: 80 * Math.pow(3.4, i),
  growth: (i + 1) * 0.00001,
}));
