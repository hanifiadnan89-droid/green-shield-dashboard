import { useState } from 'react';
import { motion } from 'motion/react';
import { Search, RefreshCw, Filter, X } from 'lucide-react';

export default function FollowupsToolbar({
  search,
  onSearchChange,
  loading,
  onRefresh,
  showFilters,
  onToggleFilters,
  activeFilterCount,
}) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <div className="fc-toolbar">
      <div className="fc-toolbar__row">
        <div className="fc-search-wrap">
          <div className={`fc-search ${searchFocused ? 'fc-search--focused' : ''}`}>
            <Search size={18} className="fc-search__icon" aria-hidden />
            <input
              className="fc-search__input"
              placeholder="Search name, phone, template, notes, status..."
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              aria-label="Search follow-ups"
            />
            {!search && (
              <kbd className="fc-search__kbd" aria-hidden>⌘K</kbd>
            )}
            {search && (
              <button
                type="button"
                className="fc-search__clear"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="fc-toolbar__actions">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`fc-btn-filters ${activeFilterCount ? 'fc-btn-filters--active' : ''}`}
          >
            <Filter size={14} aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <>
                <span className="fc-btn-filters__dot" aria-hidden />
                <span>({activeFilterCount})</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="fc-btn-icon"
            title="Refresh follow-ups"
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {showFilters && (
        <motion.p
          className="fc-toolbar__hint"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Use the pills below to filter by follow-up status. Search narrows the current view only.
        </motion.p>
      )}
    </div>
  );
}
