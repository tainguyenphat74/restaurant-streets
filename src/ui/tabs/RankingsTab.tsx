import { useGame } from '../../state/store';
import { rankings } from '../../state/economy';
import { format } from '../../utils/format';
import { Card } from '../components/Card';
export function RankingsTab() {
  const { data, now } = useGame();
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
        {rankings(data, now).map((r, i) => (
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
