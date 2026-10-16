export const riversideRestaurants = [
  {
    id: 'river_grill',
    name: 'River Grill',
    emoji: '🐟',
    color: '#479C99',
    baseCost: 12000000,
    baseIncome: 90000,
    tagline: 'Fresh from the river, warm from the grill.',
    dishes: [
      { name: 'Grilled trout', emoji: '🐟' },
      { name: 'Roast corn', emoji: '🌽' },
      { name: 'Lemon rice', emoji: '🍚' },
    ],
  },
  {
    id: 'market_gelato',
    name: 'Market Gelato',
    emoji: '🍨',
    color: '#D88CAE',
    baseCost: 60000000,
    baseIncome: 400000,
    tagline: 'A sweet scoop by the water.',
    dishes: [
      { name: 'Strawberry scoop', emoji: '🍓' },
      { name: 'Pistachio gelato', emoji: '🍨' },
      { name: 'Lemon ice', emoji: '🍋' },
    ],
  },
] as const;
