import { RotateCcw } from 'lucide-react';
import { initials, formatSent } from './threadUtils.js';

/**
 * Read-only archived conversation detail (no compose / send / AI).
 */
export default function ReplyArchivedDetail({ lead, onRestore }) {
  const sentDate = formatSent(lead.sent);

  return (
    <div className="reply-conversation flex flex-col flex-1 min-h-0">
      <div className="reply-conversation-body">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="reply-avatar-archived">
              <span className="type-label-sm font-bold text-gs-muted">{initials(lead.name)}</span>
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
          <button
            type="button"
            onClick={() => onRestore(lead)}
            title="Restore to active"
            className="btn-ghost text-xs gap-1 shrink-0 text-violet-700"
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
          <div className="reply-inbound-quote">
            <p className="type-body-sm text-gs-text leading-relaxed whitespace-pre-wrap break-words">
              {lead.sms_reply}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
