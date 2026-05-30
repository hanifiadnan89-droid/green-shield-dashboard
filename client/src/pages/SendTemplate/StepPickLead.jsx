import { Search, ChevronRight } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge.jsx';
import Spinner from '../../components/Spinner.jsx';

export default function StepPickLead({
  search,
  onSearchChange,
  leadsLoading,
  filteredLeads,
  onSelectLead,
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <label className="type-label-sm uppercase tracking-[0.06em] text-gs-muted block mb-1">
          Search Lead
        </label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted" />
          <input
            className="input pl-8"
            placeholder="Name, phone, or email..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      {leadsLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredLeads.map(lead => (
            <button
              key={lead.row_number}
              type="button"
              onClick={() => onSelectLead(lead)}
              className="w-full text-left card hover:border-gs-accent/50 transition-colors p-4 cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="type-body-sm font-medium text-gs-text group-hover:text-gs-accent transition-colors">
                    {lead.name || 'Unknown'}
                  </p>
                  <p className="type-label-sm text-gs-muted mt-0.5 font-normal tracking-normal">
                    {lead.phone}{lead.email ? ` • ${lead.email}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {lead.stop === 'yes' && <StatusBadge value="stopped" />}
                  <StatusBadge value={lead.notes} />
                  <ChevronRight size={14} className="text-gs-muted" />
                </div>
              </div>
            </button>
          ))}
          {filteredLeads.length === 0 && (
            <p className="type-body-sm text-gs-muted text-center py-8">No leads match</p>
          )}
        </div>
      )}
    </div>
  );
}
