import { afterEach, expect, it, vi } from 'vitest';
import { SAVE_KEY, serialize } from './save';
import { fresh } from './economy';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it.each(['{ broken raw ', '{ "version": 99 }'])(
  'preserves unreadable local save %s until valid import or reset',
  async (raw) => {
    vi.resetModules();
    vi.useFakeTimers();
    const storage = new Map([[SAVE_KEY, raw]]);
    const win = new EventTarget();
    Object.assign(win, {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    });
    const doc = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    const { startClock, saveNow, importGame, resetGame, exportGame } =
      await import('./tick');
    const stop = startClock();
    try {
      expect(storage.get(SAVE_KEY)).toBe(raw);
      vi.advanceTimersByTime(20000);
      win.dispatchEvent(new Event('pagehide'));
      win.dispatchEvent(new Event('beforeunload'));
      Object.assign(doc, { hidden: true });
      doc.dispatchEvent(new Event('visibilitychange'));
      expect(importGame('invalid')).toBe(false);
      expect(saveNow()).toBe(false);
      expect(exportGame()).toBeNull();
      expect(storage.get(SAVE_KEY)).toBe(raw);
      if (raw.startsWith('{ broken')) resetGame();
      else
        expect(
          importGame(serialize({ ...fresh(), coins: 123 }, Date.now())),
        ).toBe(true);
      expect(saveNow()).toBe(true);
      expect(JSON.parse(storage.get(SAVE_KEY)!).coins).toBe(
        raw.startsWith('{ broken') ? 0 : 123,
      );
    } finally {
      stop();
    }
  },
);

it('keeps storage failures distinct and reports a failed explicit recovery write', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  const win = new EventTarget();
  Object.assign(win, {
    localStorage: {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    },
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal(
    'document',
    Object.assign(new EventTarget(), { hidden: false }),
  );
  const { startClock, saveNow, importGame } = await import('./tick');
  const { useGame } = await import('./store');
  const stop = startClock();
  try {
    expect(useGame.getState().storageError).toBe(true);
    expect(saveNow()).toBe(false);
    expect(useGame.getState().storageError).toBe(true);
    expect(importGame('invalid')).toBe(false);
    expect(useGame.getState().saveProtected).toBe(true);
    expect(importGame(serialize(fresh(), Date.now()))).toBe(true);
    expect(useGame.getState().saveProtected).toBe(false);
    expect(useGame.getState().storageError).toBe(true);
  } finally {
    stop();
  }
});
