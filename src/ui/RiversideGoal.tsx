import { memo, useState } from 'react';
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

export const RiversideGoal = memo(function RiversideGoal() {
  const [hideCompleted, setHideCompleted] = useState(false);
  const unlocked = useGame((s) =>
    s.data.neighborhood.unlockedStreets.includes('riverside_market'),
  );
  const unlock = useGame((s) => s.unlockRiverside);
  const completed = useGame((s) => riversideCompleted(s.data));
  return (
    <Card aria-labelledby="riverside-title" className="riverside-goal">
      <span className="eyebrow">YOUR NEXT NEIGHBORHOOD GOAL</span>
      <h2 id="riverside-title" tabIndex={-1}>
        Riverside Market
      </h2>
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
        Unlock a new street with two restaurants. Both streets keep earning;
        upgrades and boosts are shared.
      </p>
      <Button disabled={unlocked || completed !== 6} onClick={unlock}>
        {unlocked ? '✓ Riverside unlocked' : 'Unlock Riverside Market'}
      </Button>
      {unlocked && (
        <Button
          className="secondary"
          onClick={() => {
            useGame.getState().switchStreet('riverside_market');
            useGame.getState().setTab('Street');
          }}
        >
          Visit Riverside Market ↗
        </Button>
      )}
      <label className="mastery-filter">
        <input
          type="checkbox"
          checked={hideCompleted}
          onChange={(event) => setHideCompleted(event.target.checked)}
        />
        <span>Hide completed unlock goals</span>
      </label>
      {hideCompleted && completed === riversideGoalIds.length && (
        <p role="status">All unlock goals complete.</p>
      )}
      <ul className="riverside-list">
        {riversideGoalIds.map((id) => (
          <GoalRow key={id} id={id} hideCompleted={hideCompleted} />
        ))}
      </ul>
    </Card>
  );
});
const GoalRow = memo(function GoalRow({
  id,
  hideCompleted,
}: {
  id: (typeof riversideGoalIds)[number];
  hideCompleted: boolean;
}) {
  const level = useGame((s) => riversideLevel(s.data, id));
  const select = useGame((s) => s.select);
  const restaurant = mapleRestaurants.find((r) => r.id === id)!;
  if (hideCompleted && level >= riversideTarget) return null;
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
        <progress
          aria-label={`${restaurant.name} unlock goal progress`}
          value={Math.min(level, riversideTarget)}
          max={riversideTarget}
        />
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
});
