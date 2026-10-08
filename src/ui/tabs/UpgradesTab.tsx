import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../../state/store';
import { upgrades } from '../../data/upgrades';
import { format } from '../../utils/format';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
export function UpgradesTab() {
  const { coins, gems, purchased, boosted, act } = useGame(
    useShallow((s) => ({
      coins: s.data.coins,
      gems: s.data.gems,
      purchased: s.data.upgrades,
      boosted: s.data.boostUntil > s.now,
      act: s.act,
    })),
  );
  return (
    <div className="page">
      <span className="eyebrow">SMALL CHANGES, BIG POSSIBILITIES</span>
      <h1>A little extra magic</h1>
      <p>Give every restaurant on your street a helping hand.</p>
      <div className="card-grid">
        {upgrades.map((u) => (
          <Card key={u.id}>
            <span className="big-emoji">{u.emoji}</span>
            <h2>{u.name}</h2>
            <p>{u.description}</p>
            <Button
              disabled={purchased.includes(u.id) || coins < u.cost}
              onClick={() => act('global', u.id)}
            >
              {purchased.includes(u.id)
                ? '✓ Purchased'
                : `Buy upgrade · 🪙 ${format(u.cost)}`}
            </Button>
          </Card>
        ))}
        <Card className="boost-card">
          <span className="big-emoji">⚡</span>
          <h2>A delicious rush hour</h2>
          <p>
            Double all income for 10 minutes. Earn 5 gems at restaurant levels
            10, 25, 50 and 100.
          </p>
          <Button
            disabled={gems < 10 || boosted}
            onClick={() => act('boost', '')}
          >
            {boosted ? '⚡ Boost active' : 'Start rush hour · 💎 10'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
