import { Link } from 'react-router-dom';
import { Send, StopCircle, PlayCircle, Edit3, Trash2 } from 'lucide-react';
import { getAvatarStyle, getInitials, getRowBorderColor } from '../../mockData.js';
import LeadTemplateBadge from './LeadTemplateBadge.jsx';

function StatusPill({ lead }) {
  if ((lead.error && lead.error.trim()) || lead.status === 'error' || lead.status === 'email_failed') {
    return (
      <span className="inline-flex items-center gap-1 type-label-sm px-2 py-0.5 rounded-full bg-gs-danger/10 text-gs-danger border border-gs-danger/20">
        <span className="w-1.5 h-1.5 rounded-full bg-gs-danger animate-pulse" />
        Error
      </span>
    );
  }
  if (lead.stop === 'yes') {
    return (
      <span className="inline-flex items-center gap-1 type-label-sm px-2 py-0.5 rounded-full bg-gs-muted/10 text-gs-muted border border-gs-muted/20">
        Stopped
      </span>
    );
  }
  if (lead.sms_reply === 'yes' || lead.email_reply === 'yes' || lead.status === 'replied') {
    return (
      <span className="inline-flex items-center gap-1 type-label-sm px-2 py-0.5 rounded-full bg-gs-accent/10 text-gs-accent-dim border border-gs-accent/20">
        <span className="w-1.5 h-1.5 rounded-full bg-gs-accent" />
        Replied
      </span>
    );
  }
  if (lead.sent && lead.sent !== 'imported') {
    return (
      <span className="inline-flex items-center gap-1 type-label-sm px-2 py-0.5 rounded-full bg-gs-info/10 text-gs-info border border-gs-info/20">
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 type-label-sm px-2 py-0.5 rounded-full bg-gs-muted/10 text-gs-muted border border-gs-muted/20">
      New
    </span>
  );
}

export default function LeadRow({ lead, onSelect, onPreviewAction, onDelete, isSelected }) {
  const avatar = getAvatarStyle(lead.name || '');
  const initials = getInitials(lead.name || '');
  const borderColor = getRowBorderColor(lead);

  const sentDate = lead.sent && lead.sent !== 'imported'
    ? new Date(lead.sent).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className={`lead-row flex items-center gap-3 px-4 py-3 cursor-pointer${
        isSelected ? ' lead-row--selected' : ''
      }`}
      style={{ borderLeftColor: borderColor }}
      onClick={() => onSelect(lead)}
    >
      <div
        className="lead-row__avatar flex items-center justify-center rounded-full shrink-0 font-display font-bold text-xs"
        style={{ background: avatar.bg, color: avatar.text }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <p className="type-body-sm font-semibold text-gs-text truncate leading-tight">{lead.name || '—'}</p>
        <p className="type-mono text-gs-muted truncate mt-0.5">{lead.phone || lead.email || '—'}</p>
      </div>

      <div className="shrink-0">
        <LeadTemplateBadge notes={lead.notes} />
      </div>

      <div className="shrink-0">
        <StatusPill lead={lead} />
      </div>

      <div className="hidden sm:block shrink-0 w-14 text-right">
        <p className="type-label-md text-gs-muted">{sentDate || '—'}</p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <Link
          to="/send"
          state={{ lead }}
          className="lead-row__action p-1.5 rounded-lg hover:bg-green-50 transition-colors cursor-pointer"
          title="Send template"
          onClick={e => e.stopPropagation()}
        >
          <Send size={13} className="text-gs-accent" />
        </Link>
        <button
          type="button"
          className="lead-row__action p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          title="Stop / Resume (use main dashboard)"
          onClick={() => onPreviewAction('stop', lead)}
        >
          {lead.stop === 'yes'
            ? <PlayCircle size={13} className="text-gs-accent" />
            : <StopCircle size={13} className="text-gs-danger" />}
        </button>
        <button
          type="button"
          className="lead-row__action hidden sm:flex p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer items-center"
          title="Edit (use main dashboard)"
          onClick={() => onPreviewAction('edit', lead)}
        >
          <Edit3 size={13} className="text-gs-muted" />
        </button>
        {onDelete && (
          <button
            type="button"
            className="lead-row__action hidden sm:flex p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer items-center"
            title="Delete lead"
            onClick={() => {
              if (window.confirm(`Delete ${lead.name || 'this lead'}? This cannot be undone.`)) {
                onDelete(lead);
              }
            }}
          >
            <Trash2 size={13} className="text-gs-danger" />
          </button>
        )}
      </div>
    </div>
  );
}
