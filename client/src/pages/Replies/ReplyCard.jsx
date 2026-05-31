import {
  Send, CheckCircle2, AlertCircle, Zap, Archive, Clock, Bot, AlertTriangle,
} from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';
import ChatMessage from './ChatMessage.jsx';
import { QUICK_REPLIES } from './constants.js';
import { initials, formatTime } from './threadUtils.js';

export default function ReplyCard({
  lead,
  cardState: cs,
  thread,
  sentDate,
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
  return (
    <div
      className="card flex flex-col gap-0 overflow-hidden"
      style={{ padding: 0 }}
    >
      {isConfirming && (
        <div style={{
          background: 'rgba(220,38,38,0.06)',
          borderBottom: '1px solid rgba(220,38,38,0.18)',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 500 }}>
            Archive this chat? It won&apos;t appear in your active list.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onArchive(lead)}
              style={{
                fontSize: '11px', fontWeight: 600, color: '#fff',
                background: '#DC2626', border: 'none', borderRadius: '6px',
                padding: '4px 10px', cursor: 'pointer',
              }}
            >
              Archive
            </button>
            <button
              type="button"
              onClick={onCancelArchive}
              style={{
                fontSize: '11px', fontWeight: 500, color: '#64748b',
                background: 'transparent', border: '1px solid rgba(15,42,20,0.12)',
                borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4" style={{ padding: '1.25rem' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(22,163,74,0.18), rgba(22,163,74,0.08))',
                border: '1px solid rgba(22,163,74,0.22)',
              }}
            >
              <span className="text-xs font-bold text-gs-accent">{initials(lead.name)}</span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gs-text text-sm leading-tight truncate">
                {lead.name || 'Unknown'}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {lead.phone && (
                  <span className="text-xs font-mono text-gs-muted">{lead.phone}</span>
                )}
                {sentDate && lead.phone && <span className="text-gs-border text-xs">·</span>}
                {sentDate && (
                  <span className="text-xs text-gs-muted">Sent {sentDate}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {lead.status && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                style={{
                  background: 'rgba(22,163,74,0.10)',
                  border: '1px solid rgba(22,163,74,0.22)',
                  color: '#15803d',
                }}
              >
                {lead.status}
              </span>
            )}
            <button
              type="button"
              onClick={() => onToggleArchiveConfirm(lead.row_number)}
              title="Archive this chat"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '4px', borderRadius: '6px',
                color: isConfirming ? '#DC2626' : '#94a3b8',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!isConfirming) e.currentTarget.style.color = '#DC2626'; }}
              onMouseLeave={e => { if (!isConfirming) e.currentTarget.style.color = '#94a3b8'; }}
            >
              <Archive size={14} />
            </button>
          </div>
        </div>

        <div className="h-px bg-gs-border" />

        <div>
          <div className="section-label mb-2">
            <span className="section-label-bar" style={{ background: '#7C3AED' }} />
            <Clock size={10} style={{ color: '#7C3AED', marginRight: 2 }} />
            Chat History
          </div>
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(248,250,252,0.8)',
              border: '1px solid rgba(226,232,240,0.7)',
            }}
          >
            {thread.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
                No history yet
              </p>
            ) : (
              thread.map(msg => <ChatMessage key={msg.id} msg={msg} />)
            )}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="section-label" style={{ marginBottom: 0 }}>
              <span className="section-label-bar bg-gs-accent" />
              Your Reply
            </div>
            <button
              type="button"
              onClick={() => onAIDraft(lead)}
              disabled={cs.drafting}
              title="Generate AI draft reply"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', fontWeight: 600,
                color: cs.drafting ? '#94a3b8' : '#7C3AED',
                background: cs.drafting ? 'rgba(124,58,237,0.04)' : 'rgba(124,58,237,0.08)',
                border: '1px solid rgba(124,58,237,0.22)',
                borderRadius: '8px', padding: '3px 9px',
                cursor: cs.drafting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!cs.drafting) {
                  e.currentTarget.style.background = 'rgba(124,58,237,0.14)';
                  e.currentTarget.style.color = '#6D28D9';
                }
              }}
              onMouseLeave={e => {
                if (!cs.drafting) {
                  e.currentTarget.style.background = 'rgba(124,58,237,0.08)';
                  e.currentTarget.style.color = '#7C3AED';
                }
              }}
            >
              {cs.drafting ? <Spinner size={10} /> : <Bot size={11} />}
              {cs.drafting ? 'Drafting…' : 'AI Draft'}
            </button>
          </div>
          <textarea
            id={`reply-ta-${lead.row_number}`}
            ref={textareaRef}
            rows={3}
            className="input resize-none text-sm leading-relaxed"
            placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
            value={cs.message}
            disabled={cs.sending}
            onChange={e => onUpdateCard(lead.row_number, { message: e.target.value, sent: false, error: null })}
            onKeyDown={e => onKeyDown(e, lead)}
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Zap size={11} className="text-gs-muted shrink-0" />
          {QUICK_REPLIES.map(qr => (
            <button
              key={qr.label}
              type="button"
              onClick={() => onQuickReply(lead.row_number, qr.text)}
              className="text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-all duration-150"
              style={{
                border: '1px solid rgba(15,42,20,0.12)',
                color: '#64748b',
                background: 'rgba(255,255,255,0.72)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#16a34a';
                e.currentTarget.style.borderColor = 'rgba(22,163,74,0.35)';
                e.currentTarget.style.background = 'rgba(22,163,74,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#64748b';
                e.currentTarget.style.borderColor = 'rgba(15,42,20,0.12)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.72)';
              }}
            >
              {qr.label}
            </button>
          ))}
        </div>

        {cs.draftError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '10px',
            background: 'rgba(220,38,38,0.07)',
            border: '1px solid rgba(220,38,38,0.22)',
            fontSize: '12px', color: '#DC2626',
          }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            AI draft failed: {cs.draftError}
          </div>
        )}

        {cs.reviewRequired && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '10px 14px', borderRadius: '10px',
            background: 'rgba(217,119,6,0.08)',
            border: '1px solid rgba(217,119,6,0.28)',
          }}>
            <AlertTriangle size={14} style={{ color: '#D97706', marginTop: '1px', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#B45309', margin: 0, marginBottom: '2px' }}>
                Human review recommended before sending
              </p>
              {cs.reviewReason && (
                <p style={{ fontSize: '11px', color: '#92400E', margin: 0, lineHeight: 1.45 }}>
                  {cs.reviewReason}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="text-xs min-w-0">
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
  );
}
