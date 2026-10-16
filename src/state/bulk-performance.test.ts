import { expect, it } from 'vitest';
import { fresh } from './economy';
import { buyLevels, quoteLevels } from './bulk';

it('quotes max without copying the restaurant map and buys with a single map copy', () => {
  const game = fresh();
  game.coins = 1e90;
  let mapCopies = 0;
  game.restaurants = new Proxy(game.restaurants, {
    ownKeys(target) {
      mapCopies++;
      return Reflect.ownKeys(target);
    },
  });
  expect(quoteLevels(game, 'noodle_nook', 'max').count).toBe(999);
  expect(mapCopies).toBe(0);
  const bought = buyLevels(game, 'noodle_nook', 'max');
  expect(bought.restaurants.noodle_nook.level).toBe(1000);
  expect(mapCopies).toBe(1);
});
