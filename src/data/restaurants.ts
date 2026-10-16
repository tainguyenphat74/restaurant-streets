import { mapleRestaurants } from './maple';
// The playable catalog remains Maple only until an explicit expansion release.
export const restaurants = mapleRestaurants;
export type RestaurantId = (typeof restaurants)[number]['id'];
export const config = (id: string) => restaurants.find((r) => r.id === id)!;
