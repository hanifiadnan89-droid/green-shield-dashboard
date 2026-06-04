import { useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, Calendar, Activity } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import { initials, formatSent, formatThreadTime, buildThreadWithDateDividers } from './threadUtils.js';

function replyStatusLabel(lead) {
  if (lead.sms_reply?.trim() && lead.email_reply?.trim()) return 'SMS & email';
  if (lead.email_reply?.trim()) return 'Email reply';
  if (lead.sms_reply?.trim()) return 'SMS reply';
  return 'Awaiting reply';
}

function serviceLabel(lead) {
  const raw = (lead.reason || lead.notes || '').trim();
  if (!raw) return 'Inbound';
  return raw.length > 28 ? `${raw.slice(0, 28)}…` : raw;
}

export default function ChatThread({
  lead,
  thread,
  isConfirming,
  isArchived,
  onToggleArchiveConfirm,
  onRestore,
  loading,
  syncError,
}) {
  const scrollRef = useRef(null);
  const sentDate = formatSent(lead.sent);
  const hasReplied = !!(lead.sms_reply?.trim() || lead.email_reply?.trim());

  const lastActivity = useMemo(() => {
    const last = [...thread].reverse().find(m => m.ts);
    return last ? formatThreadTime(last.ts) : null;
  }, [thread]);

  const timelineItems = useMemo(() => buildThreadWithDateDividers(thread), [thread]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lead.row_number, thread.length]);

  return (
    <motion.div
      className="rc-chat-thread flex flex-col flex-1 min-h-0"
      key={lead.row_number}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rc-chat-header rc-chat-header--bar">
        <div className="rc-chat-header__lead">
          <div
            className={`rc-avatar rc-chat-header__avatar ${
              isArchived ? 'rc-avatar--archived' : 'rc-avatar--active'
            }`}
          >
            {initials(lead.name)}
          </div>

          <div className="rc-chat-header__identity">
            <span className="rc-chat-header__name">{lead.name || 'Unknown'}</span>
            {lead.phone && (
              <span className="rc-chat-header__phone">{lead.phone}</span>
            )}
          </div>

          <div className="rc-chat-header__pills" role="list">
            {hasReplied && (
              <span className="rc-status-pill rc-status-pill--replied">REPLIED</span>
            )}
            <span className="rc-status-pill rc-status-pill--service">{serviceLabel(lead)}</span>
            {lead.status && (
              <span className="rc-status-pill rc-status-pill--status capitalize">{lead.status}</span>
            )}
            <span className="rc-status-pill rc-status-pill--reply">{replyStatusLabel(lead)}</span>
            {isArchived && (
              <span className="rc-status-pill rc-status-pill--archived">Archived</span>
            )}
          </div>
        </div>

        <div className="rc-chat-header__aside">
          {lastActivity && (
            <div className="rc-meta-card" title="Last activity">
              <Activity size={14} className="rc-meta-card__icon" aria-hidden />
              <div className="rc-meta-card__text">
                <span className="rc-meta-card__label">Last activity</span>
                <span className="rc-meta-card__value">{lastActivity}</span>
              </div>
            </div>
          )}
          {sentDate && (
            <div className="rc-meta-card" title="Outreach date">
              <Calendar size={14} className="rc-meta-card__icon" aria-hidden />
              <div className="rc-meta-card__text">
                <span className="rc-meta-card__label">Outreach</span>
                <span className="rc-meta-card__value">{sentDate}</span>
              </div>
            </div>
          )}
          {isArchived ? (
            <motion.button
              type="button"
              onClick={() => onRestore(lead)}
              className="rc-btn-ghost rc-btn-ghost--active"
              whileTap={{ scale: 0.96 }}
            >
              Restore
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => onToggleArchiveConfirm(lead.row_number)}
              title="Archive this chat"
              className={`rc-archive-btn ${isConfirming ? 'rc-archive-btn--confirm' : ''}`}
              whileTap={{ scale: 0.92 }}
              aria-label="Archive conversation"
            >
              <Archive size={18} />
            </motion.button>
          )}
        </div>
      </div>

      {syncError && (
        <div className="rc-sync-warning" role="status">
          {syncError} — showing available history.
        </div>
      )}

      <div className="rc-messages-wrap">
        <div ref={scrollRef} className="rc-messages-scroll">
          {loading ? (
            <p className="rc-list-empty py-10">Loading messages…</p>
          ) : thread.length === 0 ? (
            <p className="rc-list-empty py-10">No messages in this thread yet</p>
          ) : (
            <AnimatePresence initial={false}>
              {timelineItems.map((item, i) =>
                item.type === 'date' ? (
                  <div key={item.id} className="rc-date-divider" role="separator">
                    <span>{item.label}</span>
                  </div>
                ) : (
                  <MessageBubble
                    key={item.msg.id}
                    msg={item.msg}
                    index={i}
                  />
                ),
              )}
            </AnimatePresence>
          )}
        </div>
        <div className="rc-messages-glow" aria-hidden />
      </div>
    </motion.div>
  );
}
