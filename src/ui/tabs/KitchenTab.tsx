import { useGame } from '../../state/store';
import { restaurants } from '../../data/restaurants';
import { income, managerCost } from '../../state/economy';
import { format } from '../../utils/format';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
export function KitchenTab() {
  const { data, now, act, select } = useGame();
  return (
    <div className="page">
      <span className="eyebrow">BEHIND THE COUNTER</span>
      <h1>Your kitchens</h1>
      <p>A happy team keeps the good food coming.</p>
      <div className="card-grid">
        {restaurants
          .filter((c) => data.restaurants[c.id].owned)
          .map((c) => {
            const r = data.restaurants[c.id];
            return (
              <Card key={c.id}>
                <span className="big-emoji">{c.emoji}</span>
                <h2>{c.name}</h2>
                <p>
                  Level {r.level} · 🪙 {format(income(data, c.id, now))} / sec
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
                  disabled={r.hasManager || data.coins < managerCost(c.id)}
                  onClick={() => act('hire', c.id)}
                >
                  {r.hasManager
                    ? '✓ Manager hired'
                    : `Hire manager · 🪙 ${format(managerCost(c.id))}`}
                </Button>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
