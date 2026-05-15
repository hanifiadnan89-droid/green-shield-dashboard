import { useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import LeadRow from './LeadRow.jsx';
import EmptyState from '../../../components/EmptyState.jsx';

const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'replied',    label: 'Replied' },
  { key: 'sent',       label: 'Sent' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'errors',     label: 'Errors' },
  { key: 'stopped',    label: 'Stopped' },
];

function applyFilter(leads, filter) {
  switch (filter) {
    case 'replied':
      return leads.filter(l => l.sms_reply === 'yes' || l.email_reply === 'yes' || l.status === 'replied');
    case 'sent':
      return leads.filter(l => l.sent && l.sent !== 'imported');
    case 'inprogress':
      return leads.filter(l => {
        if (l.stop === 'yes') return false;
        if (l.status === 'replied' || l.sms_reply === 'yes' || l.email_reply === 'yes') return false;
        if ((l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed') return false;
        return !!(l.sent && l.sent !== 'imported');
      });
    case 'errors':
      return leads.filter(l => (l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed');
    case 'stopped':
      return leads.filter(l => l.stop === 'yes' || l.status === 'stopped');
    default:
      return leads;
  }
}

export default function LeadPipeline({ leads = [], activeFilter, setActiveFilter, search, setSearch, onPreviewAction }) {
  const filtered = useMemo(() => {
    let result = applyFilter(leads, activeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        ['name', 'email', 'phone', 'notes', 'status'].some(f => (l[f] || '').toLowerCase().includes(q))
      );
    }
    return [...result].sort((a, b) => (b.row_number ?? 0) - (a.row_number ?? 0));
  }, [leads, activeFilter, search]);

  return (
    <div className="p-card section-enter flex flex-col" style={{ minHeight: '400px' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-heading font-semibold text-[#0F172A] text-sm">Lead Pipeline</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{filtered.length} of {leads.length} leads</p>
          </div>
          <Link
            to="/leads"
            className="text-xs font-medium text-[#16A34A] hover:text-[#15803d] transition-colors cursor-pointer"
          >
            Full view →
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className="w-full text-sm text-[#0F172A] placeholder-[#94A3B8] rounded-xl"
            style={{
              background: '#f8fafc',
              border: '1px solid rgba(0,0,0,0.08)',
              padding: '8px 12px 8px 32px',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(22,163,74,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {FILTERS.map(({ key, label }) => {
            const isActive = activeFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className="filter-chip text-xs font-semibold px-3 py-1.5 rounded-full border"
                style={{
                  background: isActive ? '#16A34A' : '#ffffff',
                  color: isActive ? '#ffffff' : '#64748B',
                  borderColor: isActive ? '#16A34A' : 'rgba(0,0,0,0.12)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads found"
            desc={search ? 'Try a different search term' : 'No leads match this filter'}
          />
        ) : (
          filtered.slice(0, 20).map(lead => (
            <LeadRow
              key={lead.row_number}
              lead={lead}
              onPreviewAction={onPreviewAction}
            />
          ))
        )}
        {filtered.length > 20 && (
          <div className="px-5 py-3 text-center">
            <Link
              to="/leads"
              className="text-xs font-medium text-[#16A34A] hover:text-[#15803d] transition-colors"
            >
              + {filtered.length - 20} more leads — view all →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
