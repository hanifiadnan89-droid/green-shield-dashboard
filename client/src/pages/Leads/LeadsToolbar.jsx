import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, RefreshCw, Filter, X } from 'lucide-react';
import { STATUS_OPTIONS, NOTE_OPTIONS, BOOL_OPTIONS } from './leadsFilters.js';
import LeadsQuickFilters from './LeadsQuickFilters.jsx';

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
  filteredCount,
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
}) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div className="leads-toolbar">
      <div className="leads-toolbar__top">
        <div className="leads-search-wrap">
          <div className={`leads-search ${searchFocused ? 'leads-search--focused' : ''}`}>
            <Search size={18} className="leads-search__icon" />
            <input
              className="leads-search__input"
              placeholder="Search name, phone, email, notes, status..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              aria-label="Search leads"
            />
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
          <div className="leads-search__meta">
            <span>
              {filteredCount === 0
                ? 'No matching leads'
                : `${filteredCount.toLocaleString()} result${filteredCount === 1 ? '' : 's'}`}
            </span>
            {activeFilterCount > 0 && (
              <span className="text-gs-accent font-medium">
                · {activeFilterCount} advanced filter{activeFilterCount === 1 ? '' : 's'} active
              </span>
            )}
          </div>
        </div>

        <div className="leads-kpi" aria-live="polite">
          <p className="leads-kpi__label">Total Leads</p>
          <AnimatedCount value={filteredCount} />
        </div>

        <div className="leads-toolbar__actions">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`btn-ghost text-xs gap-1.5 h-10 px-3 rounded-xl ${activeFilterCount ? 'border-gs-accent text-gs-accent' : ''}`}
          >
            <Filter size={14} />
            Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="leads-btn-icon"
            title="Refresh leads"
            aria-label="Refresh"
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
                  <label className="label">{label}</label>
                  <select
                    className="select py-1.5 text-xs w-36 rounded-xl"
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
                <button type="button" onClick={onClearFilters} className="btn-ghost text-xs self-end">
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
