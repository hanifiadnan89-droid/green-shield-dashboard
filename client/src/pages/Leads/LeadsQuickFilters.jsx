import { LayoutGroup, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { QUICK_FILTERS } from './leadsFilters.js';

export default function LeadsQuickFilters({ activeId, onChange, category, notesParam }) {
  const navigate = useNavigate();

  function handleChip(id) {
    onChange(id);

    if (id === 'all') {
      navigate('/leads');
      return;
    }

    const chip = QUICK_FILTERS.find(c => c.id === id);
    if (!chip) return;

    if (chip.category) {
      navigate(`/leads?category=${chip.category}`);
      return;
    }
    if (chip.notes) {
      navigate(`/leads?notes=${chip.notes}`);
      return;
    }
    if (chip.status) {
      navigate('/leads');
      return;
    }

    navigate('/leads');
  }

  const effectiveActive = category === 'replies' ? 'replied'
    : category === 'sent' ? 'sent'
    : category === 'inprogress' ? 'followup'
    : notesParam === 'na' ? 'no_answer'
    : notesParam === 'ag' ? 'agreement'
    : activeId || 'all';

  return (
    <LayoutGroup id="leads-quick-filters">
      <div className="leads-quick-filters" role="tablist" aria-label="Quick filters">
        {QUICK_FILTERS.map(chip => {
          const isActive = effectiveActive === chip.id;
          return (
            <motion.button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleChip(chip.id)}
              className={`leads-chip relative ${isActive ? 'leads-chip--active' : ''}`}
              whileTap={{ scale: 0.97 }}
            >
              {isActive && (
                <motion.span
                  layoutId="leads-chip-indicator"
                  className="absolute inset-0 rounded-full border border-gs-accent/30 bg-gs-accent/10 -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              {chip.label}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
