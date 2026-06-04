import { motion } from 'motion/react';
import { Send, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import { formatTime } from './threadUtils.js';
import AiResponseAssistant from './AiResponseAssistant.jsx';

const SMS_MAX = 1600;

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
  const charCount = (cs.message || '').length;

  return (
    <motion.div
      className="rc-composer rc-composer--compact"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rc-composer__row">
        <div className="rc-composer__main">
          <label htmlFor={`reply-ta-${lead.row_number}`} className="rc-composer__label">
            Your reply
          </label>
          <textarea
            id={`reply-ta-${lead.row_number}`}
            ref={textareaRef}
            rows={2}
            className="rc-composer__textarea"
            placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
            value={cs.message}
            disabled={cs.sending}
            onChange={e => onUpdateCard(lead.row_number, { message: e.target.value, sent: false, error: null })}
            onKeyDown={e => onKeyDown(e, lead)}
          />
        </div>
        <motion.button
          type="button"
          onClick={() => onSend(lead)}
          disabled={!cs.message?.trim() || cs.sending}
          className="rc-send-btn rc-send-btn--stacked"
          whileHover={{ scale: 1.04, boxShadow: '0 8px 36px rgba(0,255,136,0.35)' }}
          whileTap={{ scale: 0.94 }}
        >
          {cs.sending ? (
            <>
              <Spinner size={14} />
              Sending…
            </>
          ) : (
            <>
              <Send size={16} aria-hidden />
              Send SMS
            </>
          )}
        </motion.button>
      </div>

      <div className="rc-composer__footer">
        <div className="min-w-0">
          <span className="rc-composer__char" aria-live="polite">
            {charCount} / {SMS_MAX}
          </span>
          {cs.sent && !cs.error && (
            <p className="rc-composer-status rc-composer-status--ok m-0 mt-0.5">
              <CheckCircle2 size={13} className="shrink-0 inline" aria-hidden />
              {' '}SMS sent{cs.sentAt ? ` · ${formatTime(cs.sentAt)}` : ''}
            </p>
          )}
          {cs.error && (
            <p className="rc-composer-status rc-composer-status--err m-0 mt-0.5">
              <AlertCircle size={13} className="shrink-0 inline" aria-hidden />
              {' '}{cs.error}
            </p>
          )}
        </div>
      </div>

      <AiResponseAssistant
        lead={lead}
        cardState={cs}
        onPromptChange={onAiPromptChange}
        onSubmit={onAiAssist}
      />

      {cs.reviewRequired && (
        <div className="rc-alert-review">
          <AlertTriangle size={15} className="text-[#fcd34d] mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="rc-alert-review__title">Human review recommended before sending</p>
            {cs.reviewReason && (
              <p className="rc-alert-review__body">{cs.reviewReason}</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
