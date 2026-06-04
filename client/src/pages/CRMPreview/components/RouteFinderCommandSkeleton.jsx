import { motion } from 'motion/react';

export function RouteFinderScoringSkeleton({ count = 3 }) {
  return (
    <div className="rf-skeleton-grid" aria-busy="true" aria-label="Finding best routes">
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="rf-skeleton-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.3 }}
        >
          <div className="rf-skeleton-line rf-skeleton-line--short" />
          <div className="rf-skeleton-line rf-skeleton-line--wide" />
          <div className="rf-skeleton-line rf-skeleton-line--med" />
          <div className="rf-skeleton-line rf-skeleton-line--wide" style={{ marginTop: '1rem' }} />
          <div className="rf-skeleton-line rf-skeleton-line--med" />
        </motion.div>
      ))}
    </div>
  );
}

export default RouteFinderScoringSkeleton;
