import { Link } from 'react-router-dom';
import { Send, StopCircle, PlayCircle, Edit3, Trash2 } from 'lucide-react';
import { getAvatarStyle, getInitials, getRowBorderColor } from '../../mockData.js';
import LeadTemplateBadge from './LeadTemplateBadge.jsx';
import LeadPipelineStatusPill from './LeadPipelineStatusPill.jsx';

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
        <LeadPipelineStatusPill lead={lead} />
      </div>

      <div className="hidden sm:block shrink-0 w-14 text-right">
        <p className="type-label-md text-gs-muted">{sentDate || '—'}</p>
      </div>

      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <Link
          to="/send"
          state={{ lead }}
          className="lead-row__action lead-row__action--send"
          title="Send template"
          onClick={e => e.stopPropagation()}
        >
          <Send size={13} className="text-gs-accent" />
        </Link>
        <button
          type="button"
          className="lead-row__action lead-row__action--neutral"
          title="Stop / Resume (use main dashboard)"
          onClick={() => onPreviewAction('stop', lead)}
        >
          {lead.stop === 'yes'
            ? <PlayCircle size={13} className="text-gs-accent" />
            : <StopCircle size={13} className="text-gs-danger" />}
        </button>
        <button
          type="button"
          className="lead-row__action lead-row__action--neutral hidden sm:flex items-center"
          title="Edit (use main dashboard)"
          onClick={() => onPreviewAction('edit', lead)}
        >
          <Edit3 size={13} className="text-gs-muted" />
        </button>
        {onDelete && (
          <button
            type="button"
            className="lead-row__action lead-row__action--danger hidden sm:flex items-center"
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
