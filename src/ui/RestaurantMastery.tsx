import { memo, useId } from 'react';
import { useGame } from '../state/store';
import { restaurantMastery } from '../state/mastery';

// Primitive subscriptions and memo keep clock/register updates out of this region.
export const RestaurantMastery = memo(function RestaurantMastery({
  id,
}: {
  id: string;
}) {
  const progressId = useId();
  const owned = useGame((s) => s.data.restaurants[id].owned);
  const level = useGame((s) => s.data.restaurants[id].level);
  const mastery = restaurantMastery(owned, level);
  return (
    <section
      className="restaurant-mastery milestone-progress"
      aria-label="Restaurant mastery"
    >
      <h3>Restaurant mastery</h3>
      <div aria-live="polite">
        <strong className={mastery.badge ? 'pill' : undefined}>
          {mastery.badge ? `${mastery.badge} · Earned` : 'No badges earned yet'}
        </strong>
        {mastery.target ? (
          <>
            {!owned && <p>Buy this restaurant to begin.</p>}
            <p>
              Next: {mastery.next} at level {mastery.target}
            </p>
            <label htmlFor={progressId}>
              Level {mastery.level} / {mastery.target}
            </label>
            <progress
              id={progressId}
              value={mastery.level}
              max={mastery.target}
            />
          </>
        ) : (
          <p>Mastery complete · All three badges earned.</p>
        )}
      </div>
      <small>Apprentice 25 · Artisan 50 · Master 100</small>
      <p>
        Cosmetic recognition only, earned automatically for this restaurant. No
        claim or extra reward. Existing milestone rewards and late-level income
        are unchanged.
      </p>
    </section>
  );
});
