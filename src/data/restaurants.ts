import { mapleRestaurants } from './maple';
import { riversideRestaurants } from './riverside';
export const restaurants = [...mapleRestaurants, ...riversideRestaurants];
export type RestaurantId = (typeof restaurants)[number]['id'];
export const config = (id: string) => restaurants.find((r) => r.id === id)!;
