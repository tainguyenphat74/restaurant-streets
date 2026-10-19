import { expect, it } from 'vitest';
import { fresh } from '../../src/state/economy';
import { advance, compare, start, policies } from './simulation';

it('accounts for elapsed time, expiring boosts, capacity and offline credit independently', () => {
  const initial = start();
  // Fresh Noodle rate is 1 * 3.55/4 = 0.8875/s.
  expect(advance(initial, 10, false).data.coins).toBeCloseTo(8.875, 9);
  expect(advance(initial, 120, false).data.coins).toBeCloseTo(53.25, 9);
  const data = fresh();
  data.restaurants.noodle_nook.hasManager = true;
  data.boostUntil = initial.now + 5000;
  const boosted = { ...initial, data };
  const active = advance(boosted, 10, false);
  expect(active.data.coins).toBeCloseTo(13.3125, 9);
  const offline = advance(boosted, 10, true);
  expect(offline.data.coins).toBeCloseTo(6.65625, 9);
  expect(offline.now - initial.now).toBe(10000);
  expect(advance(offline, 10, true).data.coins).toBeCloseTo(11.09375, 9);
  expect(
    advance({ ...initial, data: { ...data, boostUntil: 0 } }, 9 * 3600, true)
      .data.coins,
  ).toBe(12780);
  expect(advance(initial, 3600, true).data.coins).toBe(0);
  expect(() => advance(initial, Infinity, false)).toThrow();
  expect(() => advance(initial, -1, false)).toThrow();
});

it('continues reproducible earned checkpoints with bounded policies and gem budgets', () => {
  const result = compare();
  console.log(
    JSON.stringify(
      {
        sharedSeconds: result.shared.seconds,
        runs: Object.fromEntries(
          policies.map((p) => [
            p,
            {
              checkpoints: result.runs[p].checkpoints.map((c) => ({
                target: c.target,
                seconds: c.seconds,
              })),
              boosts: result.runs[p].boosts,
              gems: result.runs[p].data.gems,
              offlineSeconds: result.runs[p].offlineSeconds,
              managerReadySeconds: result.runs[p].managerReadySeconds,
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );
  expect(compare()).toEqual(result);
  expect(result.shared.seconds).toBeCloseTo(2695.05, 1);
  for (const policy of policies) {
    const run = result.runs[policy];
    expect(run.checkpoints.map((c) => c.target)).toEqual([25, 50, 100]);
    expect(run.checkpoints[0].data).toEqual(result.shared.data);
    for (const checkpoint of run.checkpoints) {
      expect(
        Object.values(checkpoint.data.restaurants).every(
          (r) => r.level === checkpoint.target,
        ),
      ).toBe(true);
      expect(Number.isFinite(checkpoint.data.coins)).toBe(true);
      expect(checkpoint.data.coins).toBeGreaterThanOrEqual(0);
      expect(checkpoint.data.gems).toBeGreaterThanOrEqual(0);
    }
    expect(run.seconds).toBeCloseTo(
      {
        baseline: 674998.89686,
        globals: 226796.33822,
        boosts: 217796.33842,
        offline: 423895.14528,
      }[policy],
      2,
    );
    // Early progression must remain identical; positive tuning must improve every policy.
    expect(run.checkpoints[1].seconds).toBeCloseTo(
      {
        baseline: 7274.635888427734,
        globals: 4221.584209472656,
        boosts: 3458.321171875,
        offline: 3458.409656982422,
      }[policy],
      8,
    );
    expect(run.seconds).toBeLessThan(
      {
        baseline: 950393.26194,
        globals: 318594.461,
        boosts: 309594.46009,
        offline: 585895.14528,
      }[policy],
    );
    expect(run.seconds).toBeGreaterThan(result.shared.seconds);
    expect(run.seconds).toBeLessThan(365 * 86400);
    expect(run.data.gems + run.boosts * 10).toBe(160);
    expect(run.data.coins).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(run.data.coins)).toBe(true);
    expect(
      Object.values(run.data.restaurants).every((r) => r.level === 100),
    ).toBe(true);
    expect(run.data.upgrades.length).toBe(policy === 'baseline' ? 0 : 2);
    if (policy === 'offline') {
      expect(
        Object.values(run.data.restaurants).every((r) => r.hasManager),
      ).toBe(true);
      expect(run.offlineSeconds).toBeGreaterThan(0);
      expect(run.managerReadySeconds).toBeGreaterThan(result.shared.seconds);
    } else expect(run.offlineSeconds).toBe(0);
  }
  expect(result.runs.baseline.boosts).toBe(0);
  expect(result.runs.globals.boosts).toBe(0);
  expect(result.runs.boosts.boosts).toBeGreaterThan(0);
}, 120000);
