import { useShallow } from 'zustand/react/shallow';
import { useEffect, useRef, useState } from 'react';
import { createGame } from '../../game/PhaserGame';
import { useGame } from '../../state/store';
import { restaurants } from '../../data/restaurants';
import { totalIncome } from '../../state/economy';
import { format } from '../../utils/format';
import type { StreetScene } from '../../game/scenes/StreetScene';
export function StreetTab() {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<StreetScene>();
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  useEffect(() => {
    const { game, scene: s } = createGame(host.current!, {
      select: (id) => useGame.getState().select(id),
      project: setPositions,
    });
    scene.current = s;
    const qa = new URLSearchParams(location.search).get('qa') === '1';
    if (qa)
      Object.defineProperty(window, 'restaurantQA', {
        configurable: true,
        value: () => ({
          data: structuredClone(useGame.getState().data),
          pending: useGame.getState().pending,
          scene: s.snapshot(),
        }),
      });
    return () => {
      if (qa) Reflect.deleteProperty(window, 'restaurantQA');
      game.destroy(true);
      scene.current = undefined;
    };
  }, []);
  return (
    <div className="street">
      <div ref={host} className="canvas-host" />
      <div className="street-heading">
        <span className="eyebrow">YOUR LITTLE FOOD NEIGHBORHOOD</span>
        <h1>Life tastes better here.</h1>
        <p>Six little restaurants. One big dream.</p>
      </div>
      <div className="map-overlays">
        {restaurants.map(
          (c) =>
            positions[c.id] && (
              <PlotLabel key={c.id} id={c.id} position={positions[c.id]} />
            ),
        )}
      </div>
      <div className="street-sign">
        MAPLE STREET <span>✿</span>
      </div>
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => scene.current?.zoom(1.15)}>
          +
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => scene.current?.zoom(1 / 1.15)}
        >
          −
        </button>
        <button
          aria-label="Recenter map"
          onClick={() => scene.current?.recenter()}
        >
          ⌖
        </button>
      </div>
      <StreetFooter />
    </div>
  );
}
function StreetFooter() {
  const rate = useGame((s) => totalIncome(s.data, s.now));
  const first = useGame(
    (s) => s.data.coins < 12 && s.data.restaurants.noodle_nook.level === 1,
  );
  return (
    <div className="street-footer">
      <div>
        <span className="live-dot" /> YOUR STREET IS GROWING
        <strong>
          🪙 {format(rate)}
          <small> / sec</small>
        </strong>
      </div>
      <p>
        {first
          ? 'Tap the gold coin bubble to collect your first earnings. Upgrade Noodle Nook for more!'
          : 'Drag to explore · Scroll or pinch to zoom · Tap a restaurant to visit'}
      </p>
    </div>
  );
}

function PlotLabel({
  id,
  position,
}: {
  id: string;
  position: { x: number; y: number };
}) {
  const c = restaurants.find((c) => c.id === id)!;
  const { owned, level, register, selected, select, act } = useGame(
    useShallow((s) => ({
      owned: s.data.restaurants[id].owned,
      level: s.data.restaurants[id].level,
      register: s.data.restaurants[id].register,
      selected: s.selected === id,
      select: s.select,
      act: s.act,
    })),
  );
  return (
    <div
      className={'plot-label ' + (selected ? 'selected' : '')}
      style={{ left: position.x, top: position.y }}
    >
      {selected && <span className="selection-pin">▼</span>}
      <button className="building-label" onClick={() => select(id)}>
        {owned ? c.name : 'For Sale'}
        <small>
          {owned ? `Lv ${level} · ${c.emoji}` : `🪙 ${format(c.baseCost)}`}
        </small>
      </button>
      {owned && register > 0 && (
        <button
          className="coin-bubble"
          aria-label={`Collect from ${c.name}`}
          onClick={() => act('collect', id)}
        >
          🪙 {format(register)}
        </button>
      )}
    </div>
  );
}
