import { expect, it } from 'vitest';
import { useGame } from './store';
import { fresh, levelUp } from './economy';
import { parseSave, serialize } from './save';

it('bulk store actions preserve saves and report actual levels and milestone gems', () => {
  const initial = { ...fresh(), coins: 1e9 };
  useGame.getState().restore(initial);
  useGame.getState().bulkUpgrade('noodle_nook', 'max');
  const bought = useGame.getState().data;
  let expected = initial;
  for (let i = 0; i < 999; i++) expected = levelUp(expected, 'noodle_nook');
  expect(bought).toEqual(expected);
  expect(useGame.getState().toasts.at(-1)?.text).toContain('+20 gems');
  const count = useGame.getState().toasts.length;
  useGame.getState().bulkUpgrade('missing', 'max');
  useGame.getState().bulkUpgrade('noodle_nook', 'milestone');
  expect(useGame.getState().data).toBe(bought);
  expect(useGame.getState().toasts.length).toBe(count);
  const saved = parseSave(serialize(bought, 1000));
  expect(saved?.version).toBe(1);
  expect(saved?.restaurants).toEqual(bought.restaurants);
  expect(saved?.coins).toBe(bought.coins);
  expect(saved?.gems).toBe(bought.gems);
});
