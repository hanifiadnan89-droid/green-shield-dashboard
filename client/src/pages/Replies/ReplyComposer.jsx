import { motion } from 'motion/react';
import { Send, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import { formatTime } from './threadUtils.js';
import AiResponseAssistant from './AiResponseAssistant.jsx';

export default function ReplyComposer({
  lead,
  cardState: cs,
  textareaRef,
  onUpdateCard,
  onSend,
  onKeyDown,
  onAiPromptChange,
  onAiAssist,
}) {
  return (
    <motion.div
      className="replies-composer shrink-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
    >
      <label
        htmlFor={`reply-ta-${lead.row_number}`}
        className="type-label-sm text-gs-muted uppercase tracking-wider block mb-2"
      >
        Your reply
      </label>

      <textarea
        id={`reply-ta-${lead.row_number}`}
        ref={textareaRef}
        rows={4}
        className="input resize-none type-body-sm leading-relaxed w-full"
        placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
        value={cs.message}
        disabled={cs.sending}
        onChange={e => onUpdateCard(lead.row_number, { message: e.target.value, sent: false, error: null })}
        onKeyDown={e => onKeyDown(e, lead)}
      />

      <AiResponseAssistant
        lead={lead}
        cardState={cs}
        onPromptChange={onAiPromptChange}
        onSubmit={onAiAssist}
      />

      {cs.reviewRequired && (
        <div className="reply-alert-review mt-3">
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
