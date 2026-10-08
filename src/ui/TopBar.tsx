import { useGame } from '../state/store';
import { rankings } from '../state/economy';
import { CurrencyBadge } from './components/CurrencyBadge';
export function TopBar({ settings }: { settings: () => void }) {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
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
        <Currency kind="coins" />
        <Currency kind="gems" />
        <Rank />
        <button
          className="icon-button"
          aria-label="Settings"
          onClick={settings}
        >
          ⚙
        </button>
      </div>
      <BoostTimer />
    </header>
  );
}
function Currency({ kind }: { kind: 'coins' | 'gems' }) {
  const value = useGame((s) => s.data[kind]);
  return (
    <CurrencyBadge
      icon={kind === 'coins' ? '🪙' : '💎'}
      value={value}
      label={kind === 'coins' ? 'Coins' : 'Gems'}
    />
  );
}
function Rank() {
  const rank = useGame(
    (s) =>
      rankings(s.data, Math.floor(s.now / 1000) * 1000).findIndex(
        (r) => r.player,
      ) + 1,
  );
  return (
    <span className="rank" aria-label={`Rank #${rank} on Maple Street`}>
      👑 Rank #{rank} on Maple Street
    </span>
  );
}
function BoostTimer() {
  const minutes = useGame((s) =>
    Math.max(0, Math.ceil((s.data.boostUntil - s.now) / 60000)),
  );
  return minutes > 0 ? (
    <div className="boost-timer">⚡ 2× income · {minutes} min left</div>
  ) : null;
}
