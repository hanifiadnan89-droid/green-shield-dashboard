import { LayoutGroup, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  MessageSquare,
  Send,
  PhoneOff,
  FileText,
  Archive,
  AlertCircle,
} from 'lucide-react';
import { QUICK_FILTERS } from './leadsFilters.js';

const CHIP_ICONS = {
  all: LayoutGrid,
  active: Zap,
  replied: MessageSquare,
  sent: Send,
  no_answer: PhoneOff,
  agreement: FileText,
  archived: Archive,
  followup: AlertCircle,
};

export default function LeadsQuickFilters({ activeId, onChange, category, notesParam, counts = {} }) {
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
          const Icon = CHIP_ICONS[chip.id];
          const count = counts[chip.id] ?? 0;
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
                  className="absolute inset-0 rounded-full border border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)] -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              {Icon && <Icon size={12} aria-hidden />}
              {chip.label}
              <span className="leads-chip__count">{count}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
