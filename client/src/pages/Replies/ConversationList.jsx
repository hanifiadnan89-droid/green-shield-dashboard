import { Search, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
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
      <div className="reply-inbox-search shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gs-muted pointer-events-none" />
          <input
            className="input pl-9 pr-8 type-body-sm w-full"
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            aria-label="Search conversations"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gs-muted hover:text-gs-text transition-colors p-0.5 rounded"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="reply-inbox-list flex-1 min-h-0 overflow-y-auto">
        {listCount === 0 ? (
          <p className="reply-inbox-list-empty type-body-sm text-gs-muted text-center px-4 py-8">
            {search ? 'No conversations match your search' : 'No conversations to show'}
          </p>
        ) : (
          <>
            {sortedActive.length > 0 && (
              <div>
                <p className="reply-inbox-section-label">Active ({sortedActive.length})</p>
                <AnimatePresence initial={false}>
                  {sortedActive.map(lead => {
                    const messages = threads[lead.row_number] || [];
                    return (
                      <ConversationCard
                        key={lead.row_number}
                        lead={lead}
                        selected={selectedRowNumber === lead.row_number}
                        isArchived={false}
                        hasDraft={!!(getCard(lead.row_number).message || '').trim()}
                        unread={isUnread(lead, messages, meta[lead.row_number])}
                        pulsing={pulseRows.has(lead.row_number)}
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
              <p className="reply-inbox-list-hint type-body-sm text-gs-muted px-4 py-3 border-b border-gs-border/60">
                All matching conversations are archived. Open one below or restore from the detail view.
              </p>
            )}

            {showArchived && sortedArchived.length > 0 && (
              <div>
                <p className="reply-inbox-section-label reply-inbox-section-label--archived">
                  Archived ({sortedArchived.length})
                </p>
                <AnimatePresence initial={false}>
                  {sortedArchived.map(lead => {
                    const messages = threads[lead.row_number] || [];
                    return (
                      <ConversationCard
                        key={lead.row_number}
                        lead={lead}
                        selected={selectedRowNumber === lead.row_number}
                        isArchived
                        hasDraft={false}
                        unread={false}
                        pulsing={false}
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
