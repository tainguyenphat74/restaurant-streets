import { mapleRestaurants } from './maple';
import { riversideRestaurants } from './riverside';

// Catalog availability is metadata; earned unlocks are stored separately.
export const neighborhoods = [
  {
    id: 'maple_street',
    name: 'Maple Street',
    active: true,
    restaurants: mapleRestaurants,
  },
  {
    id: 'riverside_market',
    name: 'Riverside Market',
    active: true,
    restaurants: riversideRestaurants,
  },
] as const;
