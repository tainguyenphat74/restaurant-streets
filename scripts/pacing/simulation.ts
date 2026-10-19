// Analysis only: never imported by runtime. All real progress uses production actions.
import {
  accrue,
  collect,
  fresh,
  totalIncome,
  levelUp,
  upgradeCost,
  managerCost,
  hire,
  purchaseUpgrade,
  buyBoost,
  offlineIncome,
  type GameData,
} from '../../src/state/economy';
import { restaurants } from '../../src/data/restaurants';
import { upgrades } from '../../src/data/upgrades';
import { riversideGoalIds, unlockRiverside } from '../../src/state/riverside';

const epoch = Date.UTC(2026, 0, 1);
export const start = () => ({ data: fresh(), now: epoch });
type State = ReturnType<typeof start>;
export function advance(s: State, seconds: number, offline: boolean): State {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error('Invalid interval');
  const now = s.now + seconds * 1000;
  // Direct analysis credit once for this interval, NOT the UI pending-save claim flow.
  let data = offline
    ? { ...s.data, coins: s.data.coins + offlineIncome(s.data, s.now, now) }
    : accrue(s.data, s.now, now).data;
  if (!offline) for (const c of restaurants) data = collect(data, c.id);
  if (!Number.isFinite(data.coins)) throw new Error('Nonfinite balance');
  return { data, now };
}
export const policies = ['baseline', 'globals', 'boosts', 'offline'] as const;
type Policy = (typeof policies)[number];
const seconds = (s: State) => (s.now - epoch) / 1000;

class Run {
  s: State;
  boosts = 0;
  offlineSeconds = 0;
  managerReadySeconds = 0;
  nextOffline = Infinity;
  steps = 0;
  constructor(
    s = start(),
    readonly policy: Policy = 'baseline',
  ) {
    this.s = structuredClone(s);
  }
  boost() {
    if (this.policy !== 'boosts' && this.policy !== 'offline') return;
    const next = buyBoost(this.s.data, this.s.now);
    if (next !== this.s.data) this.boosts++;
    this.s.data = next;
  }
  afford(cost: number) {
    while (this.s.data.coins < cost) {
      if (++this.steps > 2000000) throw new Error('Convergence bound');
      if (this.s.now >= this.nextOffline) {
        if (!restaurants.every((c) => this.s.data.restaurants[c.id].hasManager))
          throw new Error('Unmanaged offline policy');
        this.s = advance(this.s, 8 * 3600, true);
        this.offlineSeconds += 8 * 3600;
        this.nextOffline = this.s.now + 3600000;
        continue;
      }
      this.boost();
      const rate = totalIncome(this.s.data, this.s.now);
      if (!(rate > 0 && Number.isFinite(rate))) throw new Error('Invalid rate');
      const remainingBoost = (this.s.data.boostUntil - this.s.now) / 1000;
      // <=30s while boosted prevents a full boosted register crossing the expiry cap.
      const dt = Math.min(
        remainingBoost > 0 ? Math.min(30, remainingBoost) : 60,
        (this.nextOffline - this.s.now) / 1000,
        Math.max(0.001, (cost - this.s.data.coins) / rate),
      );
      this.s = advance(this.s, dt, false);
    }
  }
  buy(id: string) {
    const r = this.s.data.restaurants[id];
    const cost = r.owned
      ? upgradeCost(id, r.level)
      : restaurants.find((c) => c.id === id)!.baseCost;
    this.afford(cost);
    const next = levelUp(this.s.data, id);
    if (next === this.s.data) throw new Error('Purchase failed');
    this.s.data = next;
  }
  manage(id: string) {
    if (this.s.data.restaurants[id].hasManager) return;
    this.afford(managerCost(id));
    this.s.data = hire(this.s.data, id);
  }
  target(ids: readonly string[], target: number) {
    let purchases = 0;
    while (ids.some((id) => this.s.data.restaurants[id].level < target)) {
      if (++purchases > restaurants.length * target)
        throw new Error('Purchase bound');
      const g = this.s.data;
      const options = ids
        .filter((id) => g.restaurants[id].level < target)
        .map((id) => {
          const r = g.restaurants[id];
          const cost = r.owned
            ? upgradeCost(id, r.level)
            : restaurants.find((c) => c.id === id)!.baseCost;
          // Hypothetical copy ONLY for ranking, never assigned to the run or checkpoint.
          const candidate = levelUp({ ...g, coins: cost }, id);
          const gain =
            totalIncome(candidate, this.s.now) - totalIncome(g, this.s.now);
          return { id, ratio: cost / gain };
        })
        .sort((a, b) => a.ratio - b.ratio);
      this.buy(options[0].id);
    }
  }
}
export function compare() {
  const shared = new Run();
  shared.target(riversideGoalIds, 25);
  shared.s.data = unlockRiverside(shared.s.data);
  for (const id of ['river_grill', 'market_gelato']) {
    shared.buy(id);
    shared.manage(id);
  }
  shared.target(['river_grill', 'market_gelato'], 25);
  const checkpoint = {
    seconds: seconds(shared.s),
    data: structuredClone(shared.s.data),
  };
  const runs = Object.fromEntries(
    policies.map((policy) => {
      const run = new Run(shared.s, policy);
      const checkpoints = [{ target: 25, ...checkpoint }];
      // Deliberately late-game comparison: same fresh policy through both streets 25.
      if (policy !== 'baseline')
        for (const u of upgrades) {
          run.afford(u.cost);
          run.s.data = purchaseUpgrade(run.s.data, u.id);
        }
      if (policy === 'offline') {
        for (const c of restaurants) run.manage(c.id);
        run.managerReadySeconds = seconds(run.s);
        run.nextOffline = run.s.now + 3600000;
      }
      for (const target of [50, 100]) {
        run.target(
          restaurants.map((c) => c.id),
          target,
        );
        checkpoints.push({
          target,
          seconds: seconds(run.s),
          data: structuredClone(run.s.data),
        });
      }
      return [
        policy,
        {
          seconds: seconds(run.s),
          data: run.s.data,
          boosts: run.boosts,
          offlineSeconds: run.offlineSeconds,
          managerReadySeconds: run.managerReadySeconds,
          checkpoints,
        },
      ];
    }),
  ) as Record<
    Policy,
    {
      seconds: number;
      data: GameData;
      boosts: number;
      offlineSeconds: number;
      managerReadySeconds: number;
      checkpoints: { target: number; seconds: number; data: GameData }[];
    }
  >;
  return { shared: checkpoint, runs };
}
