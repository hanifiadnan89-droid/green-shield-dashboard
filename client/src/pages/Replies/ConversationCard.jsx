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
  messageCount = 0,
  preview,
  lastAt,
  onSelect,
  index = 0,
}) {
  const previewText = preview ?? previewFromMessages(null, { preview }, lead);
  const timeLabel = formatListTime(lastAt || lead.sent);
  const hasReply = !!(lead.sms_reply?.trim() || lead.email_reply?.trim());

  return (
    <motion.button
      type="button"
      layout
      layoutId={`conv-${lead.row_number}`}
      onClick={() => onSelect(lead.row_number)}
      className={[
        'rc-conv-card',
        selected ? 'rc-conv-card--selected' : '',
        isArchived ? 'rc-conv-card--archived' : '',
        unread ? 'rc-conv-card--unread' : '',
        pulsing ? 'rc-conv-card--pulse' : '',
      ].filter(Boolean).join(' ')}
      whileHover={{
        y: -3,
        scale: 1.01,
        transition: { duration: 0.22, ease: EASE },
      }}
      whileTap={{ scale: 0.99, transition: { duration: 0.1 } }}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16, scale: 0.98 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.2) }}
    >
      <span className="rc-conv-card__shimmer" aria-hidden />

      <div className={`relative shrink-0 ${unread ? 'rc-conv-card__avatar-wrap--unread' : ''}`}>
        <div className={`rc-avatar ${isArchived ? 'rc-avatar--archived' : 'rc-avatar--active'}`}>
          {initials(lead.name)}
        </div>
        <UnreadPulseBadge show={unread} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="rc-conv-card__name">{lead.name || 'Unknown'}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {selected && (
              <motion.span
                className="rc-selected-pulse"
                animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                aria-hidden
              />
            )}
            {hasDraft && <span className="rc-badge rc-badge--draft">Draft</span>}
            {messageCount > 0 && (
              <span className="rc-badge rc-badge--count">{messageCount}</span>
            )}
            {timeLabel && (
              <span className="rc-conv-card__time">{timeLabel}</span>
            )}
          </div>
        </div>
        <p className="rc-conv-card__preview">{previewText}</p>
        <p className="rc-conv-card__meta">
          {lead.phone && <span className="font-mono">{lead.phone}</span>}
          {lead.status && (
            <>
              {lead.phone && <span className="mx-1 opacity-40">·</span>}
              <span className="capitalize">{lead.status}</span>
            </>
          )}
          {hasReply && !isArchived && (
            <>
              <span className="mx-1 opacity-40">·</span>
              <span className="rc-badge rc-badge--activity inline">Replied</span>
            </>
          )}
        </p>
      </div>

      {unread && <span className="rc-unread-pill" aria-label="Unread" />}
    </motion.button>
  );
}
