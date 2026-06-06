import { AlertCircle } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import FloatingErrorCard from './FloatingErrorCard.jsx';
import useFloatingMotion from './useFloatingMotion.js';

export default function ActivityFloatingArena({
  items,
  loading,
  error,
  paused,
  onSelect,
  onRetry,
}) {
  const {
    containerRef,
    positions,
    setHovered,
    registerSize,
  } = useFloatingMotion(items, { paused });

  return (
    <section className="activity-floating-arena" aria-label="Floating error board">
      <div className="activity-floating-arena__grid" aria-hidden />

      {loading && items.length === 0 ? (
        <div className="activity-board-loading">
          <Spinner />
          <p className="text-sm text-white/45 mt-3">Syncing error board…</p>
        </div>
      ) : error && items.length === 0 ? (
        <div className="activity-board-error">
          <h3>Could not load error board</h3>
          <p>{error}</p>
          <button type="button" className="activity-board-sync mt-4" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="activity-board-empty">
          <div className="activity-board-empty__icon">
            <AlertCircle size={22} />
          </div>
          <h3>No open errors assigned to AH.</h3>
          <p>Active items from Action/Error Lists will float here when available.</p>
        </div>
      ) : (
        <div ref={containerRef} className="absolute inset-0">
          {items.map(item => (
            <FloatingErrorCard
              key={item.id}
              item={item}
              position={positions[item.id]}
              onSelect={onSelect}
              onHoverStart={setHovered}
              onHoverEnd={() => setHovered(null)}
              registerSize={registerSize}
            />
          ))}
        </div>
      )}
    </section>
  );
}
