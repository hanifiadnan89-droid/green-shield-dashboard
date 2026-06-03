import { motion } from 'motion/react';
import { initials, formatListTime, previewFromMessages } from './threadUtils.js';
import UnreadPulseBadge from './UnreadPulseBadge.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function ConversationCard({
  lead,
  selected,
  isArchived,
  hasDraft,
  unread,
  pulsing,
  preview,
  lastAt,
  onSelect,
}) {
  const previewText = preview ?? previewFromMessages(null, { preview }, lead);
  const timeLabel = formatListTime(lastAt || lead.sent);

  return (
    <motion.button
      type="button"
      layout
      layoutId={`conv-${lead.row_number}`}
      onClick={() => onSelect(lead.row_number)}
      className={[
        'replies-conv-card',
        selected ? 'replies-conv-card--selected' : '',
        isArchived ? 'replies-conv-card--archived' : '',
        unread ? 'replies-conv-card--unread' : '',
        pulsing ? 'replies-conv-card--pulse' : '',
      ].filter(Boolean).join(' ')}
      whileHover={{
        y: -2,
        scale: 1.008,
        transition: { duration: 0.2, ease: EASE },
      }}
      whileTap={{ scale: 0.996, transition: { duration: 0.12 } }}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.2 }}
    >
      <span className="replies-conv-card__shimmer" aria-hidden />

      <div className={`relative shrink-0 ${unread ? 'replies-conv-card__avatar-wrap--unread' : ''}`}>
        <div className={isArchived ? 'reply-avatar-archived' : 'reply-avatar-active'}>
          <span className={`type-label-sm font-bold ${isArchived ? 'text-gs-muted' : 'text-gs-accent'}`}>
            {initials(lead.name)}
          </span>
        </div>
        <UnreadPulseBadge show={unread} />
      </div>

      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className={`type-body-sm font-semibold truncate ${unread ? 'text-gs-text' : 'text-gs-text'}`}>
            {lead.name || 'Unknown'}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasDraft && (
              <span className="replies-draft-badge">Draft</span>
            )}
            {timeLabel && (
              <span className={`type-label-sm normal-case tracking-normal ${unread ? 'text-gs-accent font-semibold' : 'text-gs-muted'}`}>
                {timeLabel}
              </span>
            )}
          </div>
        </div>
        <p className={`type-body-sm truncate mt-0.5 ${unread ? 'text-gs-text font-medium' : 'text-gs-muted'}`}>
          {previewText}
        </p>
        {lead.phone && (
          <p className="type-label-sm text-gs-muted mt-1 normal-case tracking-normal truncate">
            <span className="type-mono">{lead.phone}</span>
            {lead.status && (
              <>
                <span className="mx-1 text-gs-border">·</span>
                <span className="capitalize">{lead.status}</span>
              </>
            )}
          </p>
        )}
      </div>

      {unread && (
        <span className="replies-unread-indicator" aria-label="Unread" />
      )}
    </motion.button>
  );
}
