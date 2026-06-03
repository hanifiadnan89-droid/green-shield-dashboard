import { motion } from 'motion/react';
import { Check, ChevronRight, Mail, Phone } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import { leadInitials } from './sendLeadUtils.js';

const EASE = [0.22, 1, 0.36, 1];

export default function LeadCard({
  lead,
  index,
  highlighted,
  onHover,
  onSelect,
}) {
  const notesCode = (lead.notes || '').trim() || null;

  return (
    <motion.li layout layoutId={`send-lead-${lead.row_number}`}>
      <motion.button
        type="button"
        layout
        onClick={() => onSelect(lead)}
        onMouseEnter={() => onHover(lead)}
        onFocus={() => onHover(lead)}
        className={`send-lead-card ${highlighted ? 'send-lead-card--highlighted' : ''}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
        transition={{ delay: Math.min(index * 0.03, 0.24), duration: 0.28, ease: EASE }}
        whileHover={{ y: -2, transition: { duration: 0.2, ease: EASE } }}
        whileTap={{ scale: 0.992, transition: { duration: 0.1 } }}
      >
        <span className="send-lead-card__shimmer" aria-hidden />

        <div className="send-lead-card__avatar" aria-hidden>
          {leadInitials(lead.name)}
        </div>

        <div className="send-lead-card__body">
          <p className="send-lead-card__name">{lead.name || 'Unknown'}</p>
          <div className="send-lead-card__contact">
            {lead.phone && (
              <span className="flex items-center gap-1.5 truncate">
                <Phone size={12} className="shrink-0 text-gs-muted" />
                {lead.phone}
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1.5 truncate">
                <Mail size={12} className="shrink-0 text-gs-muted" />
                {lead.email}
              </span>
            )}
          </div>
        </div>

        <div className="send-lead-card__aside">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {lead.stop === 'yes' && <StatusBadge value="stopped" />}
            {notesCode && <StatusBadge value={notesCode} />}
            {lead.status && lead.status !== 'replied' && !notesCode && (
              <StatusBadge value={lead.status} />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="send-lead-card__check" aria-hidden>
              {highlighted && <Check size={12} strokeWidth={3} />}
            </span>
            <ChevronRight size={14} className="text-gs-muted" />
          </div>
        </div>
      </motion.button>
    </motion.li>
  );
}
