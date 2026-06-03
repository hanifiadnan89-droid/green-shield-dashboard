import { motion } from 'motion/react';
import { Check, Mail, MessageSquare, Clock, Layers } from 'lucide-react';
import { enrichTemplate } from './templateWorkflow.js';

const EASE = [0.22, 1, 0.36, 1];

export default function TemplateWorkflowCard({
  template,
  index,
  selected,
  disabled,
  onSelect,
  onHover,
}) {
  const t = enrichTemplate(template);

  return (
    <motion.li layout layoutId={`tmpl-card-${t.code}`}>
      <motion.button
        type="button"
        layout
        disabled={disabled}
        onClick={() => onSelect(t)}
        onMouseEnter={() => onHover(t)}
        onFocus={() => onHover(t)}
        className={`send-tmpl-card ${selected ? 'send-tmpl-card--selected' : ''} ${disabled ? 'send-tmpl-card--disabled' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
        transition={{ delay: Math.min(index * 0.05, 0.2), duration: 0.3, ease: EASE }}
        whileHover={disabled ? {} : { y: -3, transition: { duration: 0.2, ease: EASE } }}
        whileTap={disabled ? {} : { scale: 0.992 }}
      >
        <span className="send-tmpl-card__shimmer" aria-hidden />
        {selected && <motion.span className="send-tmpl-card__ring" layoutId="tmpl-ring" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}

        <div className="send-tmpl-card__header">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`send-tmpl-card__code ${t.accentText}`}>{t.code.toUpperCase()}</span>
            <span className={`send-tmpl-card__badge ${t.accentDot}`}>{t.workflowBadge}</span>
          </div>
          <span className={`send-tmpl-card__check ${selected ? 'send-tmpl-card__check--on' : ''}`}>
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        </div>

        <p className={`send-tmpl-card__title ${t.accentText}`}>{t.shortName}</p>
        <p className="send-tmpl-card__desc">{t.description}</p>

        <div className="send-tmpl-card__meta">
          <span className="send-tmpl-card__meta-item">
            <Layers size={12} />
            {t.touchCount} touches
          </span>
          <span className="send-tmpl-card__meta-item">
            <Clock size={12} />
            {t.timelineDays} days
          </span>
          <span className="send-tmpl-card__meta-item">
            <MessageSquare size={12} />
            SMS
          </span>
          <span className="send-tmpl-card__meta-item">
            <Mail size={12} />
            Email
          </span>
        </div>
      </motion.button>
    </motion.li>
  );
}
