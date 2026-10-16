import { unlockRiverside, switchStreet } from './riverside';
import type { StreetId } from './economy';
import { buyLevels, type BuyMode } from './bulk';
import { create } from 'zustand';
import {
  fresh,
  levelUp,
  collect,
  hire,
  purchaseUpgrade,
  buyBoost,
  accrue,
  type GameData,
} from './economy';
type State = {
  data: GameData;
  selected: string | null;
  tab: string;
  revenue: Record<string, number>;
  toasts: { id: number; text: string }[];
  pending: number;
  storageError: boolean;
  saveProtected: boolean;
  now: number;
  unlockRiverside: () => void;
  switchStreet: (street: StreetId) => void;
  select: (id: string | null) => void;
  setTab: (tab: string) => void;
  act: (
    action: 'upgrade' | 'collect' | 'hire' | 'global' | 'boost',
    id: string,
  ) => void;
  bulkUpgrade: (id: string, mode: BuyMode) => void;
  tick: (start: number, end: number) => void;
  toast: (text: string) => void;
  restore: (data: GameData, pending?: number) => void;
};
let serial = 0;
export const useGame = create<State>((set, get) => ({
  data: fresh(),
  selected: null,
  tab: 'Street',
  revenue: {},
  toasts: [],
  pending: 0,
  storageError: false,
  saveProtected: false,
  now: Date.now(),
  unlockRiverside: () => set((s) => ({ data: unlockRiverside(s.data) })),
  switchStreet: (street) =>
    set((s) => ({ data: switchStreet(s.data, street), selected: null })),
  select: (selected) => set({ selected }),
  setTab: (tab) => set({ tab, selected: null }),
  toast: (text) => {
    const id = ++serial;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text }] }));
  },
  act: (action, id) => {
    const s = get(),
      d = s.data;
    const next =
      action === 'upgrade'
        ? levelUp(d, id)
        : action === 'collect'
          ? collect(d, id)
          : action === 'hire'
            ? hire(d, id)
            : action === 'global'
              ? purchaseUpgrade(d, id)
              : buyBoost(d, Date.now());
    if (next === d) return;
    set({ data: next });
    if (action !== 'collect')
      get().toast(
        action === 'upgrade'
          ? next.gems > d.gems
            ? 'Milestone! +5 gems 💎'
            : 'Restaurant upgraded ✨'
          : action === 'hire'
            ? 'Manager hired. You’re in good hands!'
            : action === 'boost'
              ? 'Rush hour! Double income for 10 minutes.'
              : 'Street upgrade purchased!',
      );
  },
  bulkUpgrade: (id, mode) => {
    const before = get().data;
    const data = buyLevels(before, id, mode);
    if (data === before) return;
    set({ data });
    const count = data.restaurants[id].level - before.restaurants[id].level;
    const gems = data.gems - before.gems;
    get().toast(
      `Upgraded ${count} level${count === 1 ? '' : 's'}${gems ? ` · +${gems} gems 💎` : ' ✨'}`,
    );
  },
  tick: (start, end) => {
    const s = get(),
      result = accrue(s.data, start, end),
      revenue = { ...s.revenue };
    for (const [id, value] of Object.entries(result.revenue))
      revenue[id] = (revenue[id] || 0) + value;
    set({ data: result.data, revenue, now: end });
  },
  restore: (data, pending = 0) =>
    set({ data, pending, revenue: {}, selected: null, now: Date.now() }),
}));
