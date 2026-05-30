import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import LeadRow from './LeadRow.jsx';
import EmptyState from '../../../components/EmptyState.jsx';
import LeadDetailPanel from '../../../components/LeadDetailPanel.jsx';
import { daysSince } from '../mockData.js';

const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'replied',    label: 'Replied' },
  { key: 'sent',       label: 'Sent' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'errors',     label: 'Errors' },
  { key: 'stopped',    label: 'Stopped' },
  { key: 'sold',       label: 'Sold' },
];

const DAY_FILTERS = [
  { key: 'day1', label: 'Day 1' },
  { key: 'day2', label: 'Day 2' },
  { key: 'day3', label: 'Day 3+' },
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
    case 'sold':
      return leads.filter(l => l.sold === 'yes');
    case 'day1':
      return leads.filter(l => daysSince(l.sent) === 0);
    case 'day2':
      return leads.filter(l => daysSince(l.sent) === 1);
    case 'day3': {
      return leads.filter(l => { const d = daysSince(l.sent); return d !== null && d >= 2; });
    }
    default:
      return leads;
  }
}

export default function LeadPipeline({ leads = [], activeFilter, setActiveFilter, search, setSearch, onPreviewAction, onDelete }) {
  const [selectedLead, setSelectedLead] = useState(null);

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
    <>
    <div className="p-card p-card-lift section-enter flex flex-col" style={{ minHeight: '400px' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold text-[#0F172A] text-sm">Lead Pipeline</h3>
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
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(15,42,20,0.10)',
              padding: '8px 12px 8px 32px',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: 'inset 3px 3px 7px rgba(15,42,20,0.08), inset -3px -3px 8px rgba(255,255,255,0.90)',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(22,163,74,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(22,163,74,0.08)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {/* Status filters — left group */}
          <div className="flex gap-2 flex-wrap flex-1">
            {FILTERS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className="filter-chip text-xs font-semibold px-3 py-1.5 rounded-full border"
                  style={{
                    background: isActive ? 'linear-gradient(180deg, #22c55e, #16A34A)' : 'rgba(255,255,255,0.74)',
                    color: isActive ? '#ffffff' : '#64748B',
                    borderColor: isActive ? '#16A34A' : 'rgba(15,42,20,0.10)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Day filters — right group */}
          <div className="flex gap-1 shrink-0" style={{ borderLeft: '1px solid rgba(0,0,0,0.08)', paddingLeft: 8 }}>
            {DAY_FILTERS.map(({ key, label }) => {
              const isActive = activeFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveFilter(key)}
                  className="filter-chip text-xs font-semibold px-2.5 py-1.5 rounded-full border"
                  style={{
                    background: isActive ? 'linear-gradient(180deg, #60A5FA, #3B82F6)' : 'rgba(255,255,255,0.74)',
                    color: isActive ? '#ffffff' : '#64748B',
                    borderColor: isActive ? '#3B82F6' : 'rgba(15,42,20,0.10)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
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
              onSelect={setSelectedLead}
              onPreviewAction={onPreviewAction}
              onDelete={onDelete}
              isSelected={selectedLead?.row_number === lead.row_number}
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

    {selectedLead && (
      <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
    )}
    </>
  );
}
