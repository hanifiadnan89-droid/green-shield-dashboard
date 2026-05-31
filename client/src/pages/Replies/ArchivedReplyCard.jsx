import { RotateCcw } from 'lucide-react';
import { initials } from './threadUtils.js';

export default function ArchivedReplyCard({ lead, sentDate, onRestore }) {
  return (
    <div
      className="card flex flex-col gap-4"
      style={{ padding: '1.25rem', opacity: 0.72 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(100,116,139,0.10)',
              border: '1px solid rgba(100,116,139,0.20)',
            }}
          >
            <span className="text-xs font-bold" style={{ color: '#64748b' }}>{initials(lead.name)}</span>
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
        <button
          type="button"
          onClick={() => onRestore(lead)}
          title="Restore to active"
          className="btn-ghost text-xs gap-1 shrink-0"
          style={{ color: '#7C3AED' }}
        >
          <RotateCcw size={12} />
          Restore
        </button>
      </div>

      <div className="h-px bg-gs-border" />

      <div>
        <div className="section-label mb-2">
          <span className="section-label-bar bg-gs-info" />
          Their Reply
        </div>
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: 'rgba(37,99,235,0.05)',
            border: '1px solid rgba(37,99,235,0.15)',
          }}
        >
          <p className="text-sm text-gs-text leading-relaxed whitespace-pre-wrap break-words">
            {lead.sms_reply}
          </p>
        </div>
      </div>
    </div>
  );
}
