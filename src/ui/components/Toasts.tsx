import { useEffect } from 'react';
import { useGame } from '../../state/store';
export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  useEffect(() => {
    if (!toasts.length) return;
    const timer = setTimeout(
      () => useGame.setState((s) => ({ toasts: s.toasts.slice(1) })),
      3500,
    );
    return () => clearTimeout(timer);
  }, [toasts]);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id}>{t.text}</div>
      ))}
    </div>
  );
}
