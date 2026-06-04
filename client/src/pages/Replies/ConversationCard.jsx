import { motion } from 'motion/react';
import { initials, previewFromMessages, getConversationStatusTone } from './threadUtils.js';
import { formatListTimeMaine, resolveConversationListTime } from './repliesTime.js';

const EASE = [0.22, 1, 0.36, 1];

export default function ConversationCard({
  lead,
  selected,
  isArchived,
  hasDraft,
  unread,
  pulsing,
  messages = [],
  meta,
  preview,
  lastAt,
  onSelect,
  index = 0,
}) {
  const previewText = preview ?? previewFromMessages(messages, meta, lead);
  const listTimeSource = resolveConversationListTime(lead, messages, meta) || lastAt;
  const timeLabel = formatListTimeMaine(listTimeSource);
  const statusTone = getConversationStatusTone(lead, messages);
  const showAttention = unread || pulsing;

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
        showAttention ? 'rc-conv-card--unread' : '',
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

      <div className="rc-conv-card__avatar-wrap relative shrink-0">
        <div className={`rc-avatar ${isArchived ? 'rc-avatar--archived' : 'rc-avatar--active'}`}>
          {initials(lead.name)}
        </div>
        <span
          className={`rc-conv-status-dot rc-conv-status-dot--${statusTone}${
            showAttention ? ' rc-conv-status-dot--attention' : ''
          }`}
          aria-label={
            statusTone === 'green'
              ? 'Customer has replied'
              : 'Waiting on customer response'
          }
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="rc-conv-card__name">{lead.name || 'Unknown'}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {hasDraft && <span className="rc-badge rc-badge--draft">Draft</span>}
            {timeLabel && (
              <span className={`rc-conv-card__time${showAttention ? ' rc-conv-card__time--unread' : ''}`}>
                {timeLabel}
              </span>
            )}
          </div>
        </div>
        <p className={`rc-conv-card__preview${showAttention ? ' rc-conv-card__preview--unread' : ''}`}>
          {previewText}
        </p>
        {lead.phone && (
          <p className="rc-conv-card__meta">
            <span className="font-mono">{lead.phone}</span>
          </p>
        )}
      </div>
    </motion.button>
  );
}
