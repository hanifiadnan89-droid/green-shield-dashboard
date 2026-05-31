import {
  Send, CheckCircle2, AlertCircle, Zap, Archive, Clock, Bot, AlertTriangle,
} from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import ChatMessage from './ChatMessage.jsx';
import { QUICK_REPLIES } from './constants.js';
import { initials, formatTime, formatSent } from './threadUtils.js';

/**
 * Active conversation detail — thread + compose (no card chrome).
 */
export default function ReplyConversationView({
  lead,
  cardState: cs,
  thread,
  isConfirming,
  textareaRef,
  onToggleArchiveConfirm,
  onArchive,
  onCancelArchive,
  onUpdateCard,
  onSend,
  onKeyDown,
  onQuickReply,
  onAIDraft,
}) {
  const sentDate = formatSent(lead.sent);

  return (
    <div className="reply-conversation flex flex-col flex-1 min-h-0">
      {isConfirming && (
        <div className="reply-archive-confirm shrink-0">
          <span className="type-body-sm text-gs-danger font-medium">
            Archive this chat? It won&apos;t appear in your active list.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onArchive(lead)}
              className="type-label-sm font-semibold text-white bg-gs-danger rounded-md px-2.5 py-1 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Archive
            </button>
            <button
              type="button"
              onClick={onCancelArchive}
              className="type-label-sm font-medium text-gs-muted bg-transparent border border-gs-border rounded-md px-2.5 py-1 hover:text-gs-text transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="reply-conversation-body">
        <div className="flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="reply-avatar-active">
              <span className="type-label-sm font-bold text-gs-accent">{initials(lead.name)}</span>
            </div>
            <div className="min-w-0">
              <p className="type-body-sm font-semibold text-gs-text leading-tight truncate">
                {lead.name || 'Unknown'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap type-body-sm text-gs-muted">
                {lead.phone && <span className="type-mono">{lead.phone}</span>}
                {sentDate && lead.phone && <span className="text-gs-border">·</span>}
                {sentDate && <span>Sent {sentDate}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lead.status && <span className="reply-status-pill">{lead.status}</span>}
            <button
              type="button"
              onClick={() => onToggleArchiveConfirm(lead.row_number)}
              title="Archive this chat"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                isConfirming ? 'text-gs-danger' : 'text-gs-muted hover:text-gs-danger'
              }`}
            >
              <Archive size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 gap-2">
          <div className="section-label shrink-0">
            <span className="section-label-bar bg-violet-600" />
            <Clock size={10} className="text-violet-600 mr-0.5" />
            Chat History
          </div>
          <div className="reply-thread-detail">
            {thread.length === 0 ? (
              <p className="type-body-sm text-gs-muted text-center py-3">No history yet</p>
            ) : (
              thread.map(msg => <ChatMessage key={msg.id} msg={msg} />)
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="section-label mb-0">
              <span className="section-label-bar bg-gs-accent" />
              Your Reply
            </div>
            <button
              type="button"
              onClick={() => onAIDraft(lead)}
              disabled={cs.drafting}
              title="Generate AI draft reply"
              className="btn-ai-draft"
            >
              {cs.drafting ? <Spinner size={10} /> : <Bot size={11} />}
              {cs.drafting ? 'Drafting…' : 'AI Draft'}
            </button>
          </div>
          <textarea
            id={`reply-ta-${lead.row_number}`}
            ref={textareaRef}
            rows={3}
            className="input resize-none type-body-sm leading-relaxed"
            placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
            value={cs.message}
            disabled={cs.sending}
            onChange={e => onUpdateCard(lead.row_number, { message: e.target.value, sent: false, error: null })}
            onKeyDown={e => onKeyDown(e, lead)}
          />

          <div className="flex items-center gap-1.5 flex-wrap">
            <Zap size={11} className="text-gs-muted shrink-0" />
            {QUICK_REPLIES.map(qr => (
              <button
                key={qr.label}
                type="button"
                onClick={() => onQuickReply(lead.row_number, qr.text)}
                className="quick-reply-pill"
              >
                {qr.label}
              </button>
            ))}
          </div>

          {cs.draftError && (
            <div className="reply-alert-error">
              <AlertCircle size={13} className="shrink-0" />
              AI draft failed: {cs.draftError}
            </div>
          )}

          {cs.reviewRequired && (
            <div className="reply-alert-review">
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

          <div className="flex items-center justify-between gap-3">
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
            <button
              type="button"
              onClick={() => onSend(lead)}
              disabled={!cs.message?.trim() || cs.sending}
              className="btn-primary text-xs py-1.5 px-4 gap-1.5 shrink-0"
            >
              {cs.sending ? (
                <><Spinner size={12} />Sending…</>
              ) : (
                <><Send size={12} />Send SMS</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
