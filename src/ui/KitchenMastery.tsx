import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { neighborhoods } from '../data/neighborhoods';
import { restaurantMastery } from '../state/mastery';
import { masterySummary } from '../state/mastery-summary';
import { useGame } from '../state/store';
import type { StreetId } from '../state/economy';
import { Button } from './components/Button';

type Neighborhood = (typeof neighborhoods)[number];

export const KitchenMastery = memo(function KitchenMastery() {
  return (
    <section
      className="card kitchen-mastery"
      aria-labelledby="kitchen-mastery-title"
    >
      <h2 id="kitchen-mastery-title">Kitchen mastery</h2>
      <p>Cosmetic badges only · Apprentice 25 · Artisan 50 · Master 100.</p>
      <div className="mastery-streets">
        {neighborhoods.map((street) => (
          <StreetSummary key={street.id} street={street} />
        ))}
      </div>
    </section>
  );
});

function StreetSummary({ street }: { street: Neighborhood }) {
  // Shallow numeric results exclude register, currency and clock changes.
  const summary = useGame(
    useShallow((s) => masterySummary(s.data.restaurants, street.restaurants)),
  );
  const unlocked = useGame((s) =>
    s.data.neighborhood.unlockedStreets.includes(street.id),
  );
  return (
    <section aria-label={`${street.name} mastery`}>
      <h3>
        {street.name}
        {!unlocked && ' · Locked'}
      </h3>
      <p>
        {summary.badges} / {summary.total * 3} badges earned ·{' '}
        {summary.completed} / {summary.total} restaurants complete
      </p>
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
      <ul className="mastery-list">
        {street.restaurants.map((restaurant) => (
          <MasteryRow
            key={restaurant.id}
            restaurant={restaurant}
            street={street.id}
            unlocked={unlocked}
          />
        ))}
      </ul>
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
