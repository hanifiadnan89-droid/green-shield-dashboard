import { CheckCircle2, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';
import Spinner from '../../components/Spinner.jsx';
import FloatingErrorCard from './FloatingErrorCard.jsx';
import useFloatingMotion from './useFloatingMotion.js';
import useEnteringItemIds from './useEnteringItemIds.js';
import useReducedMotion from './useReducedMotion.js';

const EASE = [0.22, 1, 0.36, 1];

export default function ActivityFloatingArena({
  items,
  loading,
  error,
  paused,
  onSelect,
  onComplete,
  onRetry,
}) {
  const reducedMotion = useReducedMotion();
  const enteringIds = useEnteringItemIds(items);
  const {
    containerRef,
    positions,
    setHovered,
    registerSize,
    hoveredId,
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
        <motion.div
          className="activity-board-empty"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.35, ease: EASE }}
        >
          <div className="activity-board-empty__icon activity-board-empty__icon--success">
            <CheckCircle2 size={24} />
          </div>
          <h3>All caught up.</h3>
          <p>No open issues assigned to you.</p>
        </motion.div>
      ) : (
        <div ref={containerRef} className="activity-floating-arena__stage">
          {items.map(item => (
            <FloatingErrorCard
              key={item.id}
              item={item}
              position={positions[item.id]}
              isEntering={enteringIds.has(item.id)}
              isHovered={hoveredId === item.id}
              reducedMotion={reducedMotion}
              onSelect={onSelect}
              onHoverStart={setHovered}
              onHoverEnd={() => setHovered(null)}
              onComplete={onComplete}
              registerSize={registerSize}
            />
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <div className="activity-board-helper" role="note">
          <Lightbulb size={14} aria-hidden />
          <span>Click any item to view details, update status, or mark as complete.</span>
        </div>
      ) : null}
    </section>
  );
}
