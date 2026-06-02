import { motion } from 'motion/react';
import { Send, CheckCircle2, AlertCircle, Zap, Bot, AlertTriangle } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import { QUICK_REPLIES } from './constants.js';
import { formatTime } from './threadUtils.js';

export default function ReplyComposer({
  lead,
  cardState: cs,
  textareaRef,
  onUpdateCard,
  onSend,
  onKeyDown,
  onQuickReply,
  onAIDraft,
}) {
  return (
    <motion.div
      className="replies-composer shrink-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="type-label-sm text-gs-muted uppercase tracking-wider">Your reply</span>
        <motion.button
          type="button"
          onClick={() => onAIDraft(lead)}
          disabled={cs.drafting}
          title="Generate AI draft reply"
          className="btn-ai-draft"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
        >
          {cs.drafting ? <Spinner size={10} /> : <Bot size={11} />}
          {cs.drafting ? 'Drafting…' : 'AI Draft'}
        </motion.button>
      </div>

      <textarea
        id={`reply-ta-${lead.row_number}`}
        ref={textareaRef}
        rows={3}
        className="input resize-none type-body-sm leading-relaxed w-full"
        placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
        value={cs.message}
        disabled={cs.sending}
        onChange={e => onUpdateCard(lead.row_number, { message: e.target.value, sent: false, error: null })}
        onKeyDown={e => onKeyDown(e, lead)}
      />

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <Zap size={11} className="text-gs-muted shrink-0" />
        {QUICK_REPLIES.map(qr => (
          <motion.button
            key={qr.label}
            type="button"
            onClick={() => onQuickReply(lead.row_number, qr.text)}
            className="quick-reply-pill"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {qr.label}
          </motion.button>
        ))}
      </div>

      {cs.draftError && (
        <div className="reply-alert-error mt-2">
          <AlertCircle size={13} className="shrink-0" />
          AI draft failed: {cs.draftError}
        </div>
      )}

      {cs.reviewRequired && (
        <div className="reply-alert-review mt-2">
          <AlertTriangle size={14} className="text-gs-warn mt-0.5 shrink-0" />
          <div>
            <p className="type-body-sm font-semibold text-amber-800 m-0 mb-0.5">
              Human review recommended before sending
            </p>
            {cs.reviewReason && (
              <p className="type-label-sm text-amber-900/90 m-0 leading-snug normal-case tracking-normal">
                {cs.reviewReason}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="type-body-sm min-w-0">
          {cs.sent && !cs.error && (
            <span className="flex items-center gap-1 text-gs-accent font-medium">
              <CheckCircle2 size={13} className="shrink-0" />
              SMS sent{cs.sentAt ? ` · ${formatTime(cs.sentAt)}` : ''}
            </span>
          )}
          {cs.error && (
            <span className="flex items-center gap-1 text-gs-danger font-medium break-words">
              <AlertCircle size={13} className="shrink-0" />
              {cs.error}
            </span>
          )}
        </div>
        <motion.button
          type="button"
          onClick={() => onSend(lead)}
          disabled={!cs.message?.trim() || cs.sending}
          className="btn-primary text-xs py-2 px-5 gap-1.5 shrink-0"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.94 }}
        >
          {cs.sending ? (
            <><Spinner size={12} />Sending…</>
          ) : (
            <><Send size={12} />Send SMS</>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
