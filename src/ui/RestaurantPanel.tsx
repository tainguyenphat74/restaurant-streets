import { useGame } from '../state/store';
import { config } from '../data/restaurants';
import { income, rating, upgradeCost, customers } from '../state/economy';
import { previews, metadata } from '../game/assets';
import { format } from '../utils/format';
import { Button } from './components/Button';
import { Pill } from './components/Pill';
import { StatItem } from './components/StatItem';
export function RestaurantPanel() {
  const { selected, select, data, act, revenue, now } = useGame();
  if (!selected) return null;
  const art = metadata('building_' + selected);
  const c = config(selected),
    r = data.restaurants[selected],
    cost = r.owned ? upgradeCost(selected, r.level) : c.baseCost;
  return (
    <aside className="restaurant-panel card" aria-label={c.name}>
      <button
        className="close icon-button"
        aria-label="Close restaurant"
        onClick={() => select(null)}
      >
        ×
      </button>
      <div className="preview" style={{ background: c.color + '22' }}>
        {previews[selected] ? (
          <img
            src={previews[selected]}
            alt={c.name}
            style={{
              transform: `scale(${art.scale})`,
              transformOrigin: `${art.anchorX * 100}% ${art.anchorY * 100}%`,
            }}
          />
        ) : (
          <span>{c.emoji}</span>
        )}
      </div>
      <h2>
        {c.name} <small>· Lv {r.level}</small>
      </h2>
      <div className="stars">
        ★★★★★{' '}
        <span>
          {rating(r.level).toFixed(1)} · {r.level * 25} reviews
        </span>
      </div>
      <p>{c.tagline}</p>
      <Pill>{r.owned ? '● Open now' : 'Your next adventure'}</Pill>
      <div className="earning">
        <span>
          {r.owned ? 'Serving happiness at' : 'Build something delicious'}
        </span>
        <strong>
          {r.owned
            ? `${format(income(data, selected, now))} 🪙 / sec`
            : `${format(c.baseIncome)} base 🪙 / sec`}
        </strong>
      </div>
      <Button
        className="w-full"
        disabled={data.coins < cost || r.level >= 1000}
        onClick={() => act('upgrade', selected)}
      >
        {r.owned ? 'Upgrade restaurant' : 'Buy restaurant'}{' '}
        <span>🪙 {format(cost)}</span>
      </Button>
      {r.owned && (
        <>
          <button
            className="collect-panel"
            disabled={r.register <= 0}
            onClick={() => act('collect', selected)}
          >
            Collect {format(r.register)} coins ↗
          </button>
          <p className="manager-status">
            {r.hasManager
              ? '🧑‍🍳 Manager on duty · Serving customers'
              : '🛎 Needs a manager · Collect coins by hand'}
          </p>
          <div className="stats">
            <StatItem
              label="Session revenue"
              value={format(revenue[selected] || 0)}
            />
            <StatItem
              label="Customers"
              value={format(customers(revenue[selected] || 0, selected))}
            />
            <StatItem label="Rating" value={rating(r.level).toFixed(1)} />
          </div>
        </>
      )}
      <h3>Made with love</h3>
      <div className="dishes">
        {c.dishes.map((d) => (
          <div key={d.name}>
            <span>{d.emoji}</span>
            <small>{d.name}</small>
          </div>
        ))}
      </div>
    </aside>
  );
}
