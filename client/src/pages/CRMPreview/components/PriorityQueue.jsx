import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MessageSquare, FileText, RefreshCw, AlertTriangle, Send, ExternalLink } from 'lucide-react';
import { getPriorityLeads, getAvatarStyle, getInitials, TEMPLATE_META } from '../mockData.js';
import LeadDetailPanel from '../../../components/LeadDetailPanel.jsx';

const GROUP_META = {
  replied:    { icon: MessageSquare, label: 'Customer Replied',            color: '#16A34A', bg: '#f0fdf4' },
  agreement:  { icon: FileText,      label: 'Agreement Pending',           color: '#2563EB', bg: '#eff6ff' },
  noAnswer:   { icon: RefreshCw,     label: 'No Answer — Follow Up',       color: '#D97706', bg: '#fffbeb' },
  inSequence: { icon: RefreshCw,     label: 'In Sequence — Follow Up Due', color: '#9333EA', bg: '#faf5ff' },
  error:      { icon: AlertTriangle, label: 'Send Error',                  color: '#DC2626', bg: '#fef2f2' },
};

function TemplateBadge({ notes }) {
  const key = (notes || '').toLowerCase();
  const meta = key === 't/m' ? TEMPLATE_META.tm : TEMPLATE_META[key];
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0"
      style={{ background: meta.bg, color: meta.textColor }}
    >
      {meta.label}
    </span>
  );
}

function LeadMiniCard({ lead, onOpen }) {
  const navigate = useNavigate();
  const avatar   = getAvatarStyle(lead.name || '');
  const initials = getInitials(lead.name || '');

  return (
    <div
      className="lead-row flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group"
      style={{
        background: '#f8fafc',
        border: '1px solid rgba(0,0,0,0.06)',
        transition: 'background 0.12s ease, border-color 0.12s ease',
      }}
      onClick={() => onOpen(lead)}
      onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderColor = 'rgba(22,163,74,0.2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; }}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0 font-heading font-bold"
        style={{ width: '28px', height: '28px', fontSize: '10px', background: avatar.bg, color: avatar.text }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="text-xs font-semibold text-[#0F172A] truncate">{lead.name || '—'}</p>
          <TemplateBadge notes={lead.notes} />
        </div>
        <p className="text-[10px] text-[#94A3B8] truncate">{lead._reason}</p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {lead._days !== null && (
          <span className="text-[10px] text-[#B4BFCC] tabular-nums">{lead._days}d</span>
        )}
        <button
          className="p-1.5 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}
          title="Send template"
          onClick={e => { e.stopPropagation(); navigate('/send', { state: { lead } }); }}
        >
          <Send size={11} />
        </button>
        <button
          className="p-1.5 rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.05)', color: '#64748B' }}
          title="View details"
          onClick={e => { e.stopPropagation(); onOpen(lead); }}
        >
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}

function PriorityGroup({ groupKey, leads, total, onOpen }) {
  const meta      = GROUP_META[groupKey];
  const GroupIcon = meta.icon;
  const overflow  = total - leads.length;
  if (leads.length === 0) return null;

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-2">
        <div style={{ background: meta.bg, borderRadius: '6px', padding: '4px', display: 'inline-flex' }}>
          <GroupIcon size={11} style={{ color: meta.color }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: meta.bg, color: meta.color }}
        >
          {total}
        </span>
      </div>
      <div className="space-y-1.5">
        {leads.map(lead => (
          <LeadMiniCard key={lead.row_number} lead={lead} onOpen={onOpen} />
        ))}
        {overflow > 0 && (
          <p className="text-[10px] text-[#B4BFCC] pl-1 pt-0.5">+{overflow} more — see Lead Pipeline below ↓</p>
        )}
      </div>
    </div>
  );
}

export default function PriorityQueue({ leads = [], loading = false }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const priority = loading ? null : getPriorityLeads(leads);

  return (
    <>
      <div className="p-card section-enter flex flex-col" style={{ minHeight: '320px' }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <h3 className="font-heading font-semibold text-[#0F172A] text-sm">Priority Work Queue</h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Who needs your attention right now</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton h-10 rounded-xl" />
              ))}
            </div>
          ) : priority?.isEmpty ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '12px', display: 'inline-flex', marginBottom: '10px' }}>
                <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">All leads are on track</p>
              <p className="text-[11px] text-[#94A3B8] mt-1">No action needed right now</p>
            </div>
          ) : (
            <>
              <PriorityGroup groupKey="replied"    leads={priority.replied}    total={priority.totals.replied}    onOpen={setSelectedLead} />
              <PriorityGroup groupKey="agreement"  leads={priority.agreements} total={priority.totals.agreements} onOpen={setSelectedLead} />
              <PriorityGroup groupKey="noAnswer"   leads={priority.noAnswer}   total={priority.totals.noAnswer}   onOpen={setSelectedLead} />
              <PriorityGroup groupKey="inSequence" leads={priority.inSequence} total={priority.totals.inSequence} onOpen={setSelectedLead} />
              <PriorityGroup groupKey="error"      leads={priority.errors}     total={priority.totals.errors}     onOpen={setSelectedLead} />
            </>
          )}
        </div>
      </div>

      {selectedLead && (
        <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </>
  );
}
