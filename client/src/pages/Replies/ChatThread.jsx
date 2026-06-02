import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Archive, Clock } from 'lucide-react';
import MessageBubble from './MessageBubble.jsx';
import { initials, formatSent } from './threadUtils.js';

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

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lead.row_number, thread.length]);

  return (
    <motion.div
      className="replies-chat-thread flex flex-col flex-1 min-h-0"
      key={lead.row_number}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="replies-chat-header shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className={isArchived ? 'reply-avatar-archived' : 'reply-avatar-active'}>
            <span className="type-label-sm font-bold text-gs-accent">{initials(lead.name)}</span>
          </div>
          <div className="min-w-0">
            <p className="type-body font-semibold text-gs-text leading-tight truncate m-0">
              {lead.name || 'Unknown'}
            </p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap type-body-sm text-gs-muted">
              {lead.phone && <span className="type-mono">{lead.phone}</span>}
              {sentDate && lead.phone && <span className="text-gs-border">·</span>}
              {sentDate && <span>Outreach {sentDate}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lead.status && <span className="reply-status-pill">{lead.status}</span>}
          {isArchived ? (
            <motion.button
              type="button"
              onClick={() => onRestore(lead)}
              className="btn-ghost text-xs gap-1 text-violet-700"
              whileTap={{ scale: 0.96 }}
            >
              Restore
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={() => onToggleArchiveConfirm(lead.row_number)}
              title="Archive this chat"
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isConfirming ? 'text-gs-danger bg-gs-danger/10' : 'text-gs-muted hover:text-gs-danger hover:bg-gs-danger/5'
              }`}
              whileTap={{ scale: 0.92 }}
            >
              <Archive size={16} />
            </motion.button>
          )}
        </div>
      </div>

      {syncError && (
        <div className="replies-sync-warning shrink-0" role="status">
          {syncError} — showing available history.
        </div>
      )}

      <div className="replies-messages-wrap flex-1 min-h-0 flex flex-col">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1 shrink-0">
          <Clock size={12} className="text-violet-600" />
          <span className="type-label-sm text-gs-muted uppercase tracking-wider">Conversation</span>
        </div>
        <div ref={scrollRef} className="replies-messages-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-4">
          {loading ? (
            <p className="type-body-sm text-gs-muted text-center py-8">Loading messages…</p>
          ) : thread.length === 0 ? (
            <p className="type-body-sm text-gs-muted text-center py-8">No messages in this thread yet</p>
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
