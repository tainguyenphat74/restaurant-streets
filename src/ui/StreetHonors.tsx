import { useShallow } from 'zustand/react/shallow';
import { neighborhoods } from '../data/neighborhoods';
import { config } from '../data/restaurants';
import { streetHonor } from '../state/honors';
import { useGame } from '../state/store';
import type { StreetId } from '../state/economy';
import { Card } from './components/Card';
import { Button } from './components/Button';

export function StreetHonors() {
  return (
    <section aria-labelledby="honors-title" className="street-honors">
      <h2 id="honors-title">Street honors</h2>
      <p>
        Own every restaurant on a street and reach each target together. Bonuses
        apply automatically to that street’s income.
      </p>
      <div className="card-grid">
        {neighborhoods.map((street) => (
          <HonorCard key={street.id} id={street.id} name={street.name} />
        ))}
      </div>
    </section>
  );
}
function HonorCard({ id, name }: { id: StreetId; name: string }) {
  // Only primitive derived values: register, wallet and clock ticks do not render.
  const honor = useGame(useShallow((s) => streetHonor(s.data, id)));
  const next = honor.nextId ? config(honor.nextId) : null;
  return (
    <Card aria-label={`${name} honors`}>
      <h3>{name}</h3>
      <p>
        {honor.owned} / {honor.total} owned
      </p>
      <p>
        {honor.at50} / {honor.total} at level 50 · +25%
        <br />
        {honor.at100} / {honor.total} at level 100 · +50% total
      </p>
      <p>
        <strong>Automatic bonus: +{(honor.multiplier - 1) * 100}%</strong>
      </p>
      {!honor.unlocked ? (
        <p>Unlock {name} first using the Riverside goal below.</p>
      ) : honor.target === 0 ? (
        <p>
          <strong>Fully complete · Both honors earned</strong>
        </p>
      ) : (
        <>
          <p>
            Next: all restaurants at level {honor.target} for +
            {honor.target === 50 ? 25 : 50}% total. The higher bonus replaces
            the lower one.
          </p>
          {next && (
            <Button
              className="secondary"
              aria-label={`Visit ${next.name}`}
              onClick={() => {
                const s = useGame.getState();
                s.switchStreet(id);
                s.setTab('Street');
                s.select(next.id);
              }}
            >
              Visit {next.name} ↗
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
