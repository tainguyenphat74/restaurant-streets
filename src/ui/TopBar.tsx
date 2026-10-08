import { useGame } from '../state/store';
import { rankings } from '../state/economy';
import { CurrencyBadge } from './components/CurrencyBadge';
export function TopBar({ settings }: { settings: () => void }) {
  const { data, tab, setTab, now } = useGame();
  return (
    <header className="topbar">
      <a
        className="brand"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          setTab('Street');
        }}
      >
        <span className="brand-icon">🍜</span>
        <span>
          Restaurant<em>Streets</em>
        </span>
      </a>
      <nav aria-label="Main navigation">
        {[
          ['Street', '⌂'],
          ['Kitchen', '♨'],
          ['Upgrades', '✦'],
          ['Rankings', '♛'],
        ].map(([name, icon]) => (
          <button
            key={name}
            aria-label={name}
            aria-current={tab === name ? 'page' : undefined}
            className={tab === name ? 'active' : ''}
            onClick={() => setTab(name)}
          >
            <span>{icon}</span>
            {name}
          </button>
        ))}
      </nav>
      <div className="wallet">
        <CurrencyBadge icon="🪙" value={data.coins} label="Coins" />
        <CurrencyBadge icon="💎" value={data.gems} label="Gems" />
        <span className="rank">
          👑 #{rankings(data, now).findIndex((r) => r.player) + 1}
        </span>
        <button
          className="icon-button"
          aria-label="Settings"
          onClick={settings}
        >
          ⚙
        </button>
      </div>
      {data.boostUntil > now && (
        <div className="boost-timer">
          ⚡ 2× income · {Math.ceil((data.boostUntil - now) / 60000)} min left
        </div>
      )}
    </header>
  );
}
