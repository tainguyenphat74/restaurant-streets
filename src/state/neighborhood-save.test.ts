import { expect, it, vi, afterEach } from 'vitest';
import { fresh } from './economy';
import { load, parseSave, serialize, SAVE_KEY } from './save';
import { importGame, resetGame, exportGame, claimOffline } from './tick';
import { useGame } from './store';

const neighborhood = {
  currentStreet: 'maple_street',
  unlockedStreets: ['maple_street'],
};
// Literal historical wire fixture: never inherit current GameData/catalog fields.
const historical = (version: number) => ({
  version,
  savedAt: 1000,
  coins: 123.25,
  gems: 42,
  boostUntil: 601000,
  pendingOffline: 456.125,
  upgrades: ['ingredients', 'service'],
  restaurants: Object.fromEntries(
    [
      'noodle_nook',
      'coffee_corner',
      'sunny_bakery',
      'taco_tuesday',
      'tomato_basil',
      'sushi_station',
    ].map((id, i) => [
      id,
      {
        owned: true,
        level: [1, 10, 25, 50, 100, 1000][i],
        hasManager: i % 2 === 0,
        register: i + 0.125,
      },
    ]),
  ),
});
afterEach(() => vi.unstubAllGlobals());
it.each([1, 2])(
  'validates v%s before adding only historical Maple defaults',
  (version) => {
    const old = historical(version);
    const expected = {
      ...old,
      restaurants: { ...fresh().restaurants, ...old.restaurants },
      version: 4,
      neighborhood,
    };
    expect(parseSave(JSON.stringify(old))).toEqual(expected);
    const storage = {
      getItem: () => JSON.stringify(old),
      setItem() {},
      removeItem() {},
    };
    const { version: _, savedAt, pendingOffline, ...data } = expected;
    expect(load(savedAt, storage)).toEqual({
      data,
      pending: pendingOffline,
      blocked: false,
      corrupt: false,
    });
    for (const change of [
      { neighborhood },
      { coins: -1 },
      { pendingOffline: null },
      { upgrades: ['future'] },
      { restaurants: {} },
    ])
      expect(parseSave(JSON.stringify({ ...old, ...change }))).toBeNull();
    const { pendingOffline: omitted, ...withoutPending } = old;
    expect(parseSave(JSON.stringify(withoutPending))).toEqual(
      version === 1 ? { ...expected, pendingOffline: 0 } : null,
    );
  },
);
it('roundtrips v3 and preserves neighborhood through import, actions, load and reset', () => {
  vi.stubGlobal('document', { hidden: false });
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
  });
  const saved = { ...historical(3), neighborhood };
  expect(importGame(JSON.stringify(saved))).toBe(true);
  expect(useGame.getState().data.neighborhood).toEqual(neighborhood);
  useGame.getState().tick(1000, 2000);
  expect(useGame.getState().data.coins).toBeGreaterThan(saved.coins);
  expect(useGame.getState().data.neighborhood).toEqual(neighborhood);
  useGame.getState().act('collect', 'coffee_corner');
  const beforeClaim = useGame.getState().data.coins;
  claimOffline();
  expect(useGame.getState().data.coins).toBe(
    beforeClaim + saved.pendingOffline,
  );
  expect(useGame.getState().pending).toBe(0);
  expect(useGame.getState().data.neighborhood).toEqual(neighborhood);
  claimOffline();
  expect(useGame.getState().data.coins).toBe(
    beforeClaim + saved.pendingOffline,
  );
  expect(parseSave(exportGame()!)?.neighborhood).toEqual(neighborhood);
  expect(load(Date.now()).data.neighborhood).toEqual(neighborhood);
  resetGame();
  expect(useGame.getState().data).toEqual(fresh());
  expect(JSON.parse(storage.get(SAVE_KEY)!).neighborhood).toEqual(neighborhood);
  expect(JSON.parse(serialize(fresh(), 0))).toMatchObject({
    version: 4,
    neighborhood,
  });
});
it('rejects missing, inactive, unknown and inconsistent neighborhood state atomically', () => {
  const before = useGame.getState().data;
  for (const invalid of [
    undefined,
    null,
    [],
    {},
    { ...neighborhood, extra: true },
    { ...neighborhood, currentStreet: 'riverside_market' },
    { ...neighborhood, currentStreet: 'unknown' },
    { ...neighborhood, unlockedStreets: [] },
    { ...neighborhood, unlockedStreets: ['maple_street', 'maple_street'] },
    { ...neighborhood, unlockedStreets: ['maple_street', 'riverside_market'] },
    { ...neighborhood, unlockedStreets: 'maple_street' },
  ]) {
    const raw = JSON.stringify({ ...historical(3), neighborhood: invalid });
    expect(parseSave(raw)).toBeNull();
    expect(importGame(raw)).toBe(false);
    expect(useGame.getState().data).toBe(before);
  }
});
