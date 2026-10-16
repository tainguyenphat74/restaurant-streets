import { mapleRestaurants } from '../data/maple';
import {
  riversideCompleted,
  riversideGoalIds,
  riversideLevel,
  riversideTarget,
} from '../state/riverside';
import { useGame } from '../state/store';
import { Card } from './components/Card';
import { Button } from './components/Button';

export function RiversideGoal() {
  const completed = useGame((s) => riversideCompleted(s.data));
  return (
    <Card aria-labelledby="riverside-title" className="riverside-goal">
      <span className="eyebrow">YOUR NEXT NEIGHBORHOOD GOAL</span>
      <h2 id="riverside-title">Riverside Market</h2>
      <p>
        Own all six Maple Street restaurants at level {riversideTarget} or
        higher.
      </p>
      <p>
        <strong>
          {completed === riversideGoalIds.length
            ? 'Goal ready'
            : 'Goal in progress'}{' '}
          · {completed} / {riversideGoalIds.length} restaurants complete
        </strong>
      </p>
      <progress
        aria-label="Riverside goal completion"
        value={completed}
        max={riversideGoalIds.length}
      />
      <p>
        Unavailable · Coming in a future update. This goal does not unlock
        Riverside, spend coins or grant rewards.
      </p>
      <ul className="riverside-list">
        {riversideGoalIds.map((id) => (
          <GoalRow key={id} id={id} />
        ))}
      </ul>
    </Card>
  );
}
function GoalRow({ id }: { id: (typeof riversideGoalIds)[number] }) {
  const level = useGame((s) => riversideLevel(s.data, id));
  const select = useGame((s) => s.select);
  const restaurant = mapleRestaurants.find((r) => r.id === id)!;
  return (
    <li>
      <div>
        <strong>
          {restaurant.emoji} {restaurant.name}
        </strong>
        <br />
        <span>
          {level === 0 ? 'Not owned · Level 0' : `Level ${level}`} /{' '}
          {riversideTarget}
          {level >= riversideTarget ? ' · Complete' : ''}
        </span>
      </div>
      <Button
        className="secondary"
        aria-label={`Visit ${restaurant.name}`}
        onClick={() => select(id)}
      >
        Visit ↗
      </Button>
    </li>
  );
}
