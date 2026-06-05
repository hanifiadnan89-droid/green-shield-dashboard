import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function LeadSearchPanel({
  search,
  onSearchChange,
  resultCount,
  totalCount,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="send-pick-lead__list-header">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="send-pick-lead__list-title">Select a lead</p>
          <p className="send-pick-lead__list-meta">
            {search
              ? `${resultCount} match${resultCount === 1 ? '' : 'es'} · ${totalCount} total`
              : `${totalCount} lead${totalCount === 1 ? '' : 's'} available`}
          </p>
        </div>
      </div>

      <div className={`send-lead-search ${focused ? 'send-lead-search--focused' : ''}`}>
        <Search size={16} className="send-lead-search__icon" aria-hidden />
        <input
          type="search"
          className="send-lead-search__input"
          placeholder="Search name, phone, or email…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-label="Search leads"
        />
        {search && (
          <motion.button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gs-muted hover:text-gs-text hover:bg-white/10"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={14} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
