import { afterEach, expect, it, vi } from 'vitest';
import { fresh } from './economy';
import { useGame } from './store';
import { claimOffline, importGame, resetGame, startClock } from './tick';
import { serialize } from './save';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function environment() {
  const storage = new Map<string, string>();
  const win = new EventTarget();
  Object.assign(win, {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  });
  const doc = new EventTarget();
  Object.assign(doc, { hidden: false });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  return { win, doc };
}
it('claims exactly once and imports atomically without pending replay', () => {
  environment();
  useGame.getState().restore(fresh(), 25);
  claimOffline();
  claimOffline();
  expect(useGame.getState().data.coins).toBe(25);
  expect(useGame.getState().pending).toBe(0);
  expect(importGame('broken')).toBe(false);
  expect(useGame.getState().data.coins).toBe(25);
  expect(importGame(serialize(fresh(), 0, 900))).toBe(true);
  expect(useGame.getState().pending).toBe(0);
  resetGame();
  expect(useGame.getState().data).toEqual(fresh());
});
it('pauses hidden ticks, checkpoints offline, and removes listeners on cleanup', () => {
  vi.useFakeTimers();
  const { doc } = environment();
  let now = 1000;
  const stop = startClock(() => now);
  const g = fresh();
  g.restaurants.noodle_nook.hasManager = true;
  useGame.getState().restore(g);
  now = 2000;
  vi.advanceTimersByTime(100);
  expect(useGame.getState().data.coins).toBeCloseTo(0.8875);
  Object.assign(doc, { hidden: true });
  doc.dispatchEvent(new Event('visibilitychange'));
  now = 12000;
  vi.advanceTimersByTime(1000);
  expect(useGame.getState().data.coins).toBeCloseTo(0.8875);
  Object.assign(doc, { hidden: false });
  doc.dispatchEvent(new Event('visibilitychange'));
  expect(useGame.getState().pending).toBeCloseTo(4.4375);
  stop();
  const data = useGame.getState().data;
  now = 13000;
  vi.advanceTimersByTime(20000);
  expect(useGame.getState().data).toBe(data);
});
