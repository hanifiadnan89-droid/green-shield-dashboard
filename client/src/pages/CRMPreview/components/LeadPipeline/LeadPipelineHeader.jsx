import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FILTERS, DAY_FILTERS } from './constants.js';

export default function LeadPipelineHeader({
  filteredCount,
  totalCount,
  search,
  onSearchChange,
  activeFilter,
  onFilterChange,
}) {
  return (
    <div className="lead-pipeline-header">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-display font-semibold text-gs-text text-sm">Lead Pipeline</h3>
          <p className="type-label-md text-gs-muted mt-0.5">{filteredCount} of {totalCount} leads</p>
        </div>
        <Link to="/leads" className="lead-pipeline-full-view">
          Full view →
        </Link>
      </div>

      <div className="lead-pipeline-search-wrap">
        <Search size={13} className="lead-pipeline-search-icon" aria-hidden />
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search by name, phone, email..."
          className="lead-pipeline-search"
          aria-label="Search leads"
        />
      </div>

      <div className="lead-pipeline-chips">
        <div className="lead-pipeline-chips-status">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={`lead-pipeline-chip filter-chip${
                activeFilter === key ? ' lead-pipeline-chip--active' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="lead-pipeline-chips-day">
          {DAY_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={`lead-pipeline-chip lead-pipeline-chip--day filter-chip${
                activeFilter === key ? ' lead-pipeline-chip--day-active' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
