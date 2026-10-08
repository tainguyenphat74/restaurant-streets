import { useGame } from '../../state/store';
import { rankingsForWorth, netWorth } from '../../state/economy';
import { format } from '../../utils/format';
import { Card } from '../components/Card';
export function RankingsTab() {
  const worth = useGame((s) => netWorth(s.data));
  const now = useGame((s) => Math.floor(s.now / 1000) * 1000);
  return (
    <div className="page rankings">
      <span className="eyebrow">A FRIENDLY NEIGHBORHOOD RIVALRY</span>
      <h1>The local favorites</h1>
      <p>
        Build your street’s net worth and climb the ranks. These neighbors are
        simulated, not live players.
      </p>
      <Card>
        <div className="leaderboard-head">
          <span>RESTAURATEUR</span>
          <span>NET WORTH</span>
        </div>
        {rankingsForWorth(worth, now).map((r, i) => (
          <div
            className={'leaderboard-row ' + (r.player ? 'you' : '')}
            key={r.name}
          >
            <b>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</b>
            <span>
              {r.name}
              {r.player && <small>THAT’S YOU</small>}
            </span>
            <strong>🪙 {format(r.worth)}</strong>
          </div>
        ))}
      </Card>
    </div>
  );
}
