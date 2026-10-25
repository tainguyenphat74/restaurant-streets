import { memo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { neighborhoods } from '../data/neighborhoods';
import { restaurantMastery } from '../state/mastery';
import { masterySummary } from '../state/mastery-summary';
import { useGame } from '../state/store';
import type { StreetId } from '../state/economy';
import { Button } from './components/Button';

type Neighborhood = (typeof neighborhoods)[number];

export const KitchenMastery = memo(function KitchenMastery() {
  const [hideCompleted, setHideCompleted] = useState(false);
  return (
    <section
      className="card kitchen-mastery"
      aria-labelledby="kitchen-mastery-title"
    >
      <h2 id="kitchen-mastery-title">Kitchen mastery</h2>
      <p>
        Apprentice 25 · Artisan 50 · Master 100. Apprentice and Artisan are
        cosmetic badges. Master perk: +10% income for each Master restaurant.
        Automatic; no claim needed.
      </p>
      <label className="mastery-filter">
        <input
          type="checkbox"
          checked={hideCompleted}
          onChange={(event) => setHideCompleted(event.target.checked)}
        />
        <span>Hide completed restaurants</span>
      </label>
      <div className="mastery-streets">
        {neighborhoods.map((street) => (
          <StreetSummary
            key={street.id}
            street={street}
            hideCompleted={hideCompleted}
          />
        ))}
      </div>
    </section>
  );
});

function StreetSummary({
  street,
  hideCompleted,
}: {
  street: Neighborhood;
  hideCompleted: boolean;
}) {
  // Shallow numeric results exclude register, currency and clock changes.
  const summary = useGame(
    useShallow((s) => masterySummary(s.data.restaurants, street.restaurants)),
  );
  const unlocked = useGame((s) =>
    s.data.neighborhood.unlockedStreets.includes(street.id),
  );
  const visibleRestaurants = useGame(
    useShallow((s) =>
      hideCompleted
        ? street.restaurants.filter((restaurant) => {
            const { owned, level } = s.data.restaurants[restaurant.id];
            return restaurantMastery(owned, level).target !== 0;
          })
        : street.restaurants,
    ),
  );
  return (
    <section aria-label={`${street.name} mastery`}>
      {/* The unchanged open prop initializes expansion; the browser owns toggles. */}
      <details className="mastery-disclosure" open>
        <summary>
          <span className="mastery-street-name" role="heading" aria-level={3}>
            {street.name}
            {!unlocked && ' · Locked'}
          </span>
          <span className="mastery-counts">
            {summary.badges} / {summary.total * 3} badges earned ·{' '}
            {summary.completed} / {summary.total} restaurants complete
          </span>
          <span className="mastery-show">Show restaurants</span>
          <span className="mastery-hide">Hide restaurants</span>
        </summary>
        {visibleRestaurants.length === 0 && <p>All restaurants mastered.</p>}
        <ul className="mastery-list">
          {visibleRestaurants.map((restaurant) => (
            <MasteryRow
              key={restaurant.id}
              restaurant={restaurant}
              street={street.id}
              unlocked={unlocked}
            />
          ))}
        </ul>
      </details>
      {!unlocked && (
        <p>
          Own all six Maple restaurants at level 25 to unlock.{' '}
          <a
            className="mastery-unlock"
            href="#riverside-title"
            onClick={() => document.getElementById('riverside-title')?.focus()}
          >
            View Riverside unlock goal
          </a>
        </p>
      )}
    </section>
  );
}

const MasteryRow = memo(function MasteryRow({
  restaurant,
  street,
  unlocked,
}: {
  restaurant: { id: string; name: string };
  street: StreetId;
  unlocked: boolean;
}) {
  const { owned, level } = useGame(
    useShallow((s) => ({
      owned: s.data.restaurants[restaurant.id].owned,
      level: s.data.restaurants[restaurant.id].level,
    })),
  );
  const mastery = restaurantMastery(owned, level);
  return (
    <li>
      <div>
        <strong>{restaurant.name}</strong>
        <span>
          {owned ? `Level ${level}` : 'Not owned'} ·{' '}
          {mastery.badge || 'No badge yet'}
        </span>
        <span>
          {mastery.target
            ? `Next: ${mastery.next} at level ${mastery.target}`
            : 'Mastery complete'}
        </span>
        {mastery.target > 0 && (
          <>
            <span>
              Level {mastery.level} / {mastery.target}
            </span>
            <progress
              aria-label={`${restaurant.name} progress to ${mastery.next}`}
              value={mastery.level}
              max={mastery.target}
            />
          </>
        )}
        <span>
          {owned && level >= 100
            ? 'Master perk active: +10% income for this restaurant.'
            : 'Next perk: +10% income for this restaurant at Master (level 100).'}
        </span>
      </div>
      {unlocked ? (
        <Button
          className="secondary"
          aria-label={`Visit ${restaurant.name}`}
          onClick={() => {
            const state = useGame.getState();
            // Recheck availability at activation; switching never unlocks a street.
            if (!state.data.neighborhood.unlockedStreets.includes(street))
              return;
            state.switchStreet(street);
            state.setTab('Street');
            state.select(restaurant.id);
          }}
        >
          Visit ↗
        </Button>
      ) : (
        <span>Locked</span>
      )}
    </li>
  );
});
