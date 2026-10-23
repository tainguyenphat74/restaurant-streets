import { useMemo, useState } from 'react';
import { RestaurantMastery } from './RestaurantMastery';
import { quoteLevels, nextMilestone, type BuyMode } from '../state/bulk';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../state/store';
import { config } from '../data/restaurants';
import { income, rating, upgradeCost, customers } from '../state/economy';
import { previews, metadata } from '../game/assets';
import { format } from '../utils/format';
import { Button } from './components/Button';
import { Pill } from './components/Pill';
import { StatItem } from './components/StatItem';
export function RestaurantPanel() {
  const selected = useGame((s) => s.selected);
  return selected ? (
    <SelectedRestaurant key={selected} selected={selected} />
  ) : null;
}
function SelectedRestaurant({ selected }: { selected: string }) {
  const [mode, setMode] = useState<BuyMode>('1');
  const { select, coins, gems, r, act, bulkUpgrade, revenue, rate } = useGame(
    useShallow((s) => ({
      select: s.select,
      gems: s.data.gems,
      bulkUpgrade: s.bulkUpgrade,
      coins: s.data.coins,
      r: s.data.restaurants[selected],
      act: s.act,
      revenue: s.revenue[selected] || 0,
      rate: income(s.data, selected, s.now),
    })),
  );
  if (!selected) return null;
  const art = metadata('building_' + selected);
  const c = config(selected),
    cost = r.owned ? upgradeCost(selected, r.level) : c.baseCost;
  const quote = useMemo(
    () => quoteLevels(useGame.getState().data, selected, mode),
    [selected, mode, coins, gems, r.level, r.owned],
  );
  const target = nextMilestone(r.level);
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
            ? `${format(rate)} 🪙 / sec`
            : `${format(c.baseIncome)} base 🪙 / sec`}
        </strong>
      </div>
      {r.owned && (
        <>
          <div className="buy-modes" role="group" aria-label="Upgrade quantity">
            {(
              [
                ['1', 'Buy 1'],
                ['10', 'Buy 10'],
                ['milestone', 'Next milestone'],
                ['max', 'Buy max'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={mode === value}
                disabled={r.level >= 1000 || (value === 'milestone' && !target)}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="bulk-quote" aria-live="polite">
            {quote.count} level{quote.count === 1 ? '' : 's'} · 🪙{' '}
            {format(quote.cost)}
            {quote.gems > 0 && ` · +${quote.gems} gems`}
            {quote.count === 0 &&
              r.level < 1000 &&
              (mode !== 'milestone' || target) &&
              ' · Insufficient coins'}
          </p>
          <small>Buys up to the affordable quantity.</small>
          <div className="milestone-progress">
            {target ? (
              <>
                <label htmlFor="milestone-progress">
                  Level {r.level} / {target} · Next milestone
                </label>
                <progress
                  id="milestone-progress"
                  value={r.level}
                  max={target}
                />
                <small>At level {target}: ×2 income milestone · +5 gems</small>
              </>
            ) : (
              <p>All milestones complete · All four rewards earned</p>
            )}
            {r.level >= 1000 && <p>Max level reached · Level 1000</p>}
          </div>
        </>
      )}
      <Button
        className="w-full"
        disabled={r.owned ? quote.count === 0 : coins < cost}
        onClick={() =>
          r.owned ? bulkUpgrade(selected, mode) : act('upgrade', selected)
        }
      >
        {r.owned ? 'Upgrade restaurant' : 'Buy restaurant'}{' '}
        <span>🪙 {format(r.owned && mode !== '1' ? quote.cost : cost)}</span>
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
            <StatItem label="Session revenue" value={format(revenue)} />
            <StatItem
              label="Customers"
              value={format(customers(revenue, selected))}
            />
            <StatItem label="Rating" value={rating(r.level).toFixed(1)} />
          </div>
        </>
      )}
      <RestaurantMastery id={selected} />
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
