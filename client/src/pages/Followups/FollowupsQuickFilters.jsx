import { motion, LayoutGroup } from 'motion/react';
import { QUICK_FILTERS } from './followupsUtils.js';

export default function FollowupsQuickFilters({ value, onChange, counts }) {
  return (
    <LayoutGroup>
      <div className="followups-chips">
        {QUICK_FILTERS.map((f) => {
          const active = value === f.id;
          const count = counts[f.id];
          return (
            <motion.button
              key={f.id}
              type="button"
              layout
              className={`followups-chip${active ? ' followups-chip--active' : ''}`}
              onClick={() => onChange(f.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              {f.label}
              {typeof count === 'number' && count > 0 && (
                <span className="ml-1.5 opacity-70 tabular-nums">({count})</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
