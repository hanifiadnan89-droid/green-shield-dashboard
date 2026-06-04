import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, RefreshCw, Filter, X } from 'lucide-react';
import { STATUS_OPTIONS, NOTE_OPTIONS, BOOL_OPTIONS } from './leadsFilters.js';
import LeadsQuickFilters from './LeadsQuickFilters.jsx';
import { buildLeadSparkline, sparklinePath } from './leadsSparkline.js';

function AnimatedCount({ value }) {
  return (
    <motion.span
      key={value}
      className="leads-kpi__value"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {value.toLocaleString()}
    </motion.span>
  );
}

export default function LeadsToolbar({
  search,
  onSearchChange,
  totalLeads,
  allLeads,
  loading,
  onRefresh,
  showFilters,
  onToggleFilters,
  filters,
  onFiltersChange,
  activeFilterCount,
  onClearFilters,
  quickFilter,
  onQuickFilterChange,
  category,
  notesParam,
  filterCounts,
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const sparkValues = useMemo(() => buildLeadSparkline(allLeads, 7), [allLeads]);
  const sparkD = useMemo(() => sparklinePath(sparkValues), [sparkValues]);

  return (
    <div className="leads-toolbar">
      <div className="leads-toolbar__top">
        <div className="leads-search-wrap">
          <div className={`leads-search ${searchFocused ? 'leads-search--focused' : ''}`}>
            <Search size={18} className="leads-search__icon" aria-hidden />
            <input
              className="leads-search__input"
              placeholder="Search name, phone, email, notes, status..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              aria-label="Search leads"
            />
            {!search && (
              <kbd className="leads-search__kbd" aria-hidden>⌘K</kbd>
            )}
            {search && (
              <button
                type="button"
                className="leads-search__clear"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="leads-kpi leads-kpi--inline" aria-live="polite">
          <div className="leads-kpi__main">
            <p className="leads-kpi__label">Total Leads</p>
            <AnimatedCount value={totalLeads} />
          </div>
          <svg
            className="leads-kpi__spark"
            width="72"
            height="22"
            viewBox="0 0 88 28"
            aria-hidden
          >
            <path d={sparkD} />
          </svg>
        </div>

        <div className="leads-toolbar__actions">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`lc-btn-filters ${activeFilterCount ? 'lc-btn-filters--active' : ''}`}
          >
            <Filter size={14} aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <>
                <span className="lc-btn-filters__dot" aria-hidden />
                <span>({activeFilterCount})</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="leads-btn-icon"
            title="Refresh leads"
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <LeadsQuickFilters
        activeId={quickFilter}
        onChange={onQuickFilterChange}
        category={category}
        notesParam={notesParam}
        counts={filterCounts}
      />

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            className="leads-advanced-filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="leads-advanced-filters__inner">
              {[
                { key: 'status', label: 'Status', options: STATUS_OPTIONS },
                { key: 'notes', label: 'Notes/Template', options: NOTE_OPTIONS },
                { key: 'stop', label: 'Stopped', options: BOOL_OPTIONS },
                { key: 'sms_reply', label: 'SMS Reply', options: BOOL_OPTIONS },
                { key: 'email_reply', label: 'Email Reply', options: BOOL_OPTIONS },
              ].map(({ key, label, options }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label>{label}</label>
                  <select
                    value={filters[key]}
                    onChange={e => onFiltersChange(p => ({ ...p, [key]: e.target.value }))}
                  >
                    {options.map(o => (
                      <option key={o || 'any'} value={o}>{o || 'Any'}</option>
                    ))}
                  </select>
                </div>
              ))}
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="lc-btn-filters self-end"
                >
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
