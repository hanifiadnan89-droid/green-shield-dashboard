import { useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, Clock, Radio } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import { initials, formatSent, formatThreadTime } from './threadUtils.js';

function replyStatusLabel(lead) {
  if (lead.sms_reply?.trim() && lead.email_reply?.trim()) return 'SMS & email';
  if (lead.email_reply?.trim()) return 'Email reply';
  if (lead.sms_reply?.trim()) return 'SMS reply';
  return 'Awaiting reply';
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

  const lastActivity = useMemo(() => {
    const last = [...thread].reverse().find(m => m.ts);
    return last ? formatThreadTime(last.ts) : null;
  }, [thread]);

  const leadSource = (lead.reason || lead.notes || '').trim()
    ? (lead.reason || lead.notes).slice(0, 48)
    : 'Inbound';

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lead.row_number, thread.length]);

  return (
    <motion.div
      className="flex flex-col flex-1 min-h-0"
      key={lead.row_number}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rc-chat-header">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`rc-avatar rc-chat-header__avatar ${
              isArchived ? 'rc-avatar--archived' : 'rc-avatar--active'
            }`}
          >
            {initials(lead.name)}
          </div>
          <div className="min-w-0">
            <p className="rc-chat-header__name truncate">{lead.name || 'Unknown'}</p>
            {lead.phone && (
              <p className="rc-chat-header__phone m-0 mt-0.5">{lead.phone}</p>
            )}
            <div className="rc-chat-header__badges">
              <span className="rc-status-pill rc-status-pill--source" title="Lead source">
                {leadSource}
              </span>
              {lead.status && (
                <span className="rc-status-pill capitalize">{lead.status}</span>
              )}
              <span className="rc-status-pill rc-status-pill--reply">
                {replyStatusLabel(lead)}
              </span>
              {isArchived && (
                <span className="rc-status-pill rc-status-pill--archived">Archived</span>
              )}
            </div>
            {lastActivity && (
              <p className="rc-chat-header__activity m-0">
                <Radio size={10} className="text-[#4ade80]" aria-hidden />
                Last activity · {lastActivity}
              </p>
            )}
            {sentDate && (
              <p className="rc-chat-header__activity m-0 mt-0.5">
                <Clock size={10} aria-hidden />
                Outreach {sentDate}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        <div className="rc-messages-label">
          <Clock size={12} aria-hidden />
          Conversation timeline
        </div>
        <div ref={scrollRef} className="rc-messages-scroll">
          {loading ? (
            <p className="rc-list-empty py-10">Loading messages…</p>
          ) : thread.length === 0 ? (
            <p className="rc-list-empty py-10">No messages in this thread yet</p>
          ) : (
            <AnimatePresence initial={false}>
              {thread.map((msg, i) => (
                <MessageBubble key={msg.id} msg={msg} index={i} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}
