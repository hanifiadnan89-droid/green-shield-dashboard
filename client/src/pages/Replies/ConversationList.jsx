import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import ConversationCard from './ConversationCard.jsx';
import { previewFromMessages, getConversationSortTime } from './threadUtils.js';

export default function ConversationList({
  search,
  onSearchChange,
  showArchived,
  activeLeads,
  archivedLeads,
  selectedRowNumber,
  getCard,
  onSelectLead,
  threads,
  meta,
  isUnread,
  pulseRows,
}) {
  const [searchFocused, setSearchFocused] = useState(false);
  const listCount = activeLeads.length + (showArchived ? archivedLeads.length : 0);
  const searchPlaceholder = showArchived
    ? 'Search active and archived…'
    : 'Search conversations…';

  function sortLeads(leads) {
    return [...leads].sort((a, b) => {
      const ta = getConversationSortTime(a, threads[a.row_number], meta[a.row_number]);
      const tb = getConversationSortTime(b, threads[b.row_number], meta[b.row_number]);
      return tb - ta;
    });
  }

  const sortedActive = sortLeads(activeLeads);
  const sortedArchived = sortLeads(archivedLeads);

  return (
    <aside className="replies-inbox-sidebar" aria-label="Conversations">
      <div className="rc-search-wrap">
        <div className={`rc-search ${searchFocused ? 'rc-search--focused' : ''}`}>
          <Search size={15} className="rc-search__icon" aria-hidden />
          <input
            className="rc-search__input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            aria-label="Search conversations"
          />
          {!search && (
            <kbd className="rc-search__kbd" aria-hidden>⌘K</kbd>
          )}
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="rc-search__clear"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="rc-conv-list">
        {listCount === 0 ? (
          <p className="rc-list-empty">
            {search.trim()
              ? 'No conversations match your search.'
              : 'No conversations to show'}
          </p>
        ) : (
          <>
            {sortedActive.length > 0 && (
              <div>
                <p className="rc-section-label">Active ({sortedActive.length})</p>
                <AnimatePresence initial={false}>
                  {sortedActive.map((lead, i) => {
                    const messages = threads[lead.row_number] || [];
                    return (
                      <ConversationCard
                        key={lead.row_number}
                        index={i}
                        lead={lead}
                        selected={selectedRowNumber === lead.row_number}
                        isArchived={false}
                        hasDraft={!!(getCard(lead.row_number).message || '').trim()}
                        unread={isUnread(lead, messages, meta[lead.row_number])}
                        pulsing={pulseRows.has(lead.row_number)}
                        messages={messages}
                        meta={meta[lead.row_number]}
                        preview={previewFromMessages(messages, meta[lead.row_number], lead)}
                        lastAt={meta[lead.row_number]?.lastAt}
                        onSelect={onSelectLead}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {sortedActive.length === 0 && showArchived && sortedArchived.length > 0 && (
              <p className="rc-list-hint">
                All matching conversations are archived. Open one below or restore from the detail view.
              </p>
            )}

            {showArchived && sortedArchived.length > 0 && (
              <div>
                <p className="rc-section-label rc-section-label--archived">
                  Archived ({sortedArchived.length})
                </p>
                <AnimatePresence initial={false}>
                  {sortedArchived.map((lead, i) => {
                    const messages = threads[lead.row_number] || [];
                    return (
                      <ConversationCard
                        key={lead.row_number}
                        index={i}
                        lead={lead}
                        selected={selectedRowNumber === lead.row_number}
                        isArchived
                        hasDraft={false}
                        unread={false}
                        pulsing={false}
                        messages={messages}
                        meta={meta[lead.row_number]}
                        preview={previewFromMessages(messages, meta[lead.row_number], lead)}
                        lastAt={meta[lead.row_number]?.lastAt}
                        onSelect={onSelectLead}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
