import { LayoutGroup, motion } from 'motion/react';
import { QUICK_FILTERS } from './followupsUtils.js';

const CHIP_TONE = {
  overdue: 'danger',
  manual: 'warn',
};

export default function FollowupsQuickFilters({ value, onChange, counts }) {
  return (
    <LayoutGroup id="followups-quick-filters">
      <div className="fc-quick-filters" role="tablist" aria-label="Follow-up filters">
        {QUICK_FILTERS.map((f) => {
          const active = value === f.id;
          const count = counts[f.id] ?? 0;
          const tone = CHIP_TONE[f.id];
          return (
            <motion.button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              layout
              className={[
                'fc-chip relative',
                active ? 'fc-chip--active' : '',
                tone ? `fc-chip--${tone}` : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onChange(f.id)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              {active && (
                <motion.span
                  layoutId="fc-chip-glow"
                  className="absolute inset-0 rounded-full border border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)] -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              {f.label}
              <span className="fc-chip__count">({count})</span>
              {f.id === 'manual' && count > 0 && (
                <span className="fc-chip__dot" aria-hidden />
              )}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
