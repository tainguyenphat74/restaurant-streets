import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../../state/store';
import { restaurants } from '../../data/restaurants';
import { income, managerCost } from '../../state/economy';
import { format } from '../../utils/format';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
export function KitchenTab() {
  return (
    <div className="page">
      <span className="eyebrow">BEHIND THE COUNTER</span>
      <h1>Your kitchens</h1>
      <p>A happy team keeps the good food coming.</p>
      <div className="card-grid">
        {restaurants.map((c) => (
          <KitchenCard key={c.id} id={c.id} />
        ))}
      </div>
    </div>
  );
}

function KitchenCard({ id }: { id: string }) {
  const c = restaurants.find((c) => c.id === id)!;
  const { owned, level, hasManager, rate, canHire, act, select } = useGame(
    useShallow((s) => ({
      owned: s.data.restaurants[id].owned,
      level: s.data.restaurants[id].level,
      hasManager: s.data.restaurants[id].hasManager,
      rate: income(s.data, id, s.now),
      canHire: s.data.coins >= managerCost(id),
      act: s.act,
      select: s.select,
    })),
  );
  if (!owned) return null;
  const r = { level, hasManager };
  return (
    <Card>
      <span className="big-emoji">{c.emoji}</span>
      <h2>{c.name}</h2>
      <p>
        Level {r.level} · 🪙 {format(rate)} / sec
      </p>
      <Button onClick={() => select(c.id)}>Visit restaurant ↗</Button>
      <hr />
      <h3>
        {r.hasManager
          ? 'Your manager is on duty'
          : 'A little help goes a long way'}
      </h3>
      <p>
        {r.hasManager
          ? 'Coins collected automatically, even while you’re away.'
          : 'Hire a manager for automatic collection and 50% offline earnings.'}
      </p>
      <Button
        className="secondary"
        disabled={r.hasManager || !canHire}
        onClick={() => act('hire', c.id)}
      >
        {r.hasManager
          ? '✓ Manager hired'
          : `Hire manager · 🪙 ${format(managerCost(c.id))}`}
      </Button>
    </Card>
  );
}
