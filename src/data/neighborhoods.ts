import { mapleRestaurants } from './maple';

// Definitions are metadata, not unlocks. Inactive neighborhoods have no economy.
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
    active: false,
    restaurants: [],
  },
] as const;
