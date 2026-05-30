import { Link } from 'react-router-dom';
import { Send, StopCircle, PlayCircle, Edit3, Trash2 } from 'lucide-react';
import { getAvatarStyle, getInitials, getRowBorderColor, TEMPLATE_META } from '../mockData.js';

function TemplateBadge({ notes }) {
  const key = (notes || '').toLowerCase();
  const meta = key === 't/m' ? TEMPLATE_META.tm : TEMPLATE_META[key];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center type-label-sm uppercase px-2 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.textColor }}
    >
      {meta.label}
    </span>
  );
}

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
      className="lead-row flex items-center gap-3 px-4 py-3 cursor-pointer"
      style={{
        borderLeft: `3px solid ${borderColor}`,
        borderBottom: '1px solid rgba(15,42,20,0.06)',
        background: isSelected ? 'rgba(22,163,74,0.08)' : 'rgba(255,255,255,0.30)',
      }}
      onClick={() => onSelect(lead)}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center rounded-full shrink-0 font-display font-bold text-xs"
        style={{ width: '36px', height: '36px', background: avatar.bg, color: avatar.text, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72), 4px 5px 10px rgba(15,42,20,0.08)' }}
      >
        {initials}
      </div>

      {/* Name + contact */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate leading-tight">{lead.name || '—'}</p>
        <p className="type-mono text-[#94A3B8] truncate mt-0.5">{lead.phone || lead.email || '—'}</p>
      </div>

      {/* Template badge */}
      <div className="shrink-0">
        <TemplateBadge notes={lead.notes} />
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusPill lead={lead} />
      </div>

      {/* Sent date — hidden on mobile to prevent overflow */}
      <div className="hidden sm:block shrink-0 w-14 text-right">
        <p className="type-label-md text-[#94A3B8]">{sentDate || '—'}</p>
      </div>

      {/* Quick actions — Edit + Delete hidden on mobile */}
      <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        <Link
          to="/send"
          state={{ lead }}
          className="p-1.5 rounded-lg hover:bg-green-50 transition-colors cursor-pointer"
          title="Send template"
          onClick={e => e.stopPropagation()}
        >
          <Send size={13} style={{ color: '#16A34A' }} />
        </Link>
        <button
          className="p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          title="Stop / Resume (use main dashboard)"
          onClick={() => onPreviewAction('stop', lead)}
        >
          {lead.stop === 'yes'
            ? <PlayCircle size={13} style={{ color: '#16A34A' }} />
            : <StopCircle size={13} style={{ color: '#DC2626' }} />}
        </button>
        <button
          className="hidden sm:flex p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer items-center"
          title="Edit (use main dashboard)"
          onClick={() => onPreviewAction('edit', lead)}
        >
          <Edit3 size={13} style={{ color: '#94A3B8' }} />
        </button>
        {onDelete && (
          <button
            className="hidden sm:flex p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer items-center"
            title="Delete lead"
            onClick={() => {
              if (window.confirm(`Delete ${lead.name || 'this lead'}? This cannot be undone.`)) {
                onDelete(lead);
              }
            }}
          >
            <Trash2 size={13} style={{ color: '#DC2626' }} />
          </button>
        )}
      </div>
    </div>
  );
}
