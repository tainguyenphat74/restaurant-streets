import { useGame } from './store';
import { load, persist, parseSave, serialize } from './save';
import { fresh, offlineIncome } from './economy';
let started = false;
let checkpoint = Date.now();
let hiddenAt: number | null = null;
export const saveNow = (now = Date.now()) => {
  const s = useGame.getState();
  if (s.saveProtected) return false;
  const ok = persist(s.data, hiddenAt ?? now, s.pending);
  useGame.setState({ storageError: !ok });
  return ok;
};
export function startClock(clock: () => number = Date.now) {
  const now = clock();
  if (!started) {
    const loaded = load(now);
    useGame.getState().restore(loaded.data, loaded.pending);
    useGame.setState({
      storageError: loaded.blocked,
      saveProtected: loaded.corrupt || loaded.blocked,
    });
    started = true;
    saveNow(now);
  }
  checkpoint = now;
  hiddenAt = document.hidden ? now : null;
  const tick = () => {
    const now = clock();
    if (hiddenAt !== null) return;
    useGame.getState().tick(checkpoint, Math.min(now, checkpoint + 1000));
    checkpoint = now;
  };
  const visibility = () => {
    const now = clock();
    if (document.hidden) {
      tick();
      hiddenAt = now;
      saveNow(now);
    } else if (hiddenAt !== null) {
      const s = useGame.getState();
      useGame.setState({
        pending: s.pending + offlineIncome(s.data, hiddenAt, now),
        now,
      });
      hiddenAt = null;
      checkpoint = now;
      saveNow(now);
    }
  };
  const leave = () => {
    if (hiddenAt === null) tick();
    saveNow(clock());
  };
  const interval = setInterval(tick, 100),
    autosave = setInterval(() => saveNow(clock()), 10000);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', leave);
  window.addEventListener('beforeunload', leave);
  return () => {
    clearInterval(interval);
    clearInterval(autosave);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', leave);
    window.removeEventListener('beforeunload', leave);
  };
}
export function claimOffline() {
  const s = useGame.getState();
  if (s.pending <= 0) return;
  const data = { ...s.data, coins: s.data.coins + s.pending };
  useGame.setState({ data, pending: 0 });
  saveNow();
}
export function resetGame() {
  useGame.setState({ saveProtected: false });
  useGame.getState().restore(fresh());
  checkpoint = Date.now();
  hiddenAt = document.hidden ? checkpoint : null;
  saveNow();
}
export function importGame(raw: string) {
  const saved = parseSave(raw);
  if (!saved) return false;
  useGame.setState({ saveProtected: false });
  useGame.getState().restore(
    {
      coins: saved.coins,
      gems: saved.gems,
      restaurants: saved.restaurants,
      upgrades: saved.upgrades,
      boostUntil: saved.boostUntil,
    },
    saved.pendingOffline ?? 0,
  );
  checkpoint = Date.now();
  hiddenAt = document.hidden ? checkpoint : null;
  saveNow();
  return true;
}
export function exportGame() {
  const s = useGame.getState();
  if (s.saveProtected) return null;
  return serialize(s.data, Date.now(), s.pending);
}
