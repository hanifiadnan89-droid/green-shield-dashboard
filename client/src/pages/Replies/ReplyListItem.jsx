import { initials, formatSent } from './threadUtils.js';

function previewText(text, max = 72) {
  const t = (text || '').trim();
  if (!t) return '—';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export default function ReplyListItem({
  lead,
  selected,
  isArchived,
  hasDraft,
  onSelect,
}) {
  const sentDate = formatSent(lead.sent);

  return (
    <button
      type="button"
      onClick={() => onSelect(lead.row_number)}
      className={`reply-list-item ${selected ? 'reply-list-item--selected' : ''} ${
        isArchived ? 'opacity-80' : ''
      }`}
    >
      <div className={isArchived ? 'reply-avatar-archived' : 'reply-avatar-active'}>
        <span className={`type-label-sm font-bold ${isArchived ? 'text-gs-muted' : 'text-gs-accent'}`}>
          {initials(lead.name)}
        </span>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="type-body-sm font-semibold text-gs-text truncate">
            {lead.name || 'Unknown'}
          </p>
          {hasDraft && (
            <span className="type-label-sm text-gs-accent shrink-0 normal-case tracking-normal">
              Draft
            </span>
          )}
        </div>
        <p className="type-body-sm text-gs-muted truncate mt-0.5">
          {previewText(lead.sms_reply)}
        </p>
        {(lead.phone || sentDate) && (
          <p className="type-label-sm text-gs-muted mt-1 normal-case tracking-normal truncate">
            {lead.phone && <span className="type-mono">{lead.phone}</span>}
            {lead.phone && sentDate && ' · '}
            {sentDate && `Sent ${sentDate}`}
          </p>
        )}
      </div>
    </button>
  );
}
