import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../../../../components/EmptyState.jsx';
import LeadDetailPanel from '../../../../components/LeadDetailPanel.jsx';
import { applyFilter } from './applyFilter.js';
import { PREVIEW_ROW_LIMIT } from './constants.js';
import LeadPipelineHeader from './LeadPipelineHeader.jsx';
import LeadRow from './LeadRow.jsx';

export default function LeadPipelineView({
  leads = [],
  activeFilter,
  setActiveFilter,
  search,
  setSearch,
  onPreviewAction,
  onDelete,
}) {
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
      <div className="p-card p-card-lift section-enter lead-pipeline flex flex-col">
        <LeadPipelineHeader
          filteredCount={filtered.length}
          totalCount={leads.length}
          search={search}
          onSearchChange={setSearch}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        <div className="lead-pipeline-list flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No leads found"
              desc={search ? 'Try a different search term' : 'No leads match this filter'}
            />
          ) : (
            filtered.slice(0, PREVIEW_ROW_LIMIT).map(lead => (
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
          {filtered.length > PREVIEW_ROW_LIMIT && (
            <div className="lead-pipeline-more px-5 py-3 text-center">
              <Link to="/leads" className="lead-pipeline-more-link">
                + {filtered.length - PREVIEW_ROW_LIMIT} more leads — view all →
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
