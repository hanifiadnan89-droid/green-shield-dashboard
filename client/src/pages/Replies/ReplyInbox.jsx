import { Search, X, ChevronLeft } from 'lucide-react';
import ReplyListItem from './ReplyListItem.jsx';

export default function ReplyInbox({
  search,
  onSearchChange,
  showArchived,
  activeLeads,
  archivedLeads,
  selectedRowNumber,
  detailOpen,
  onClearSelection,
  getCard,
  onSelectLead,
  children,
}) {
  const listCount = activeLeads.length + (showArchived ? archivedLeads.length : 0);
  const searchPlaceholder = showArchived
    ? 'Search active and archived…'
    : 'Search active conversations…';

  return (
    <div className={`reply-inbox ${detailOpen ? 'reply-inbox--detail-open' : ''}`}>
      <aside className="reply-inbox-sidebar" aria-label="Conversations">
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
              {activeLeads.length > 0 && (
                <div>
                  <p className="reply-inbox-section-label">Active ({activeLeads.length})</p>
                  {activeLeads.map(lead => (
                    <ReplyListItem
                      key={lead.row_number}
                      lead={lead}
                      selected={selectedRowNumber === lead.row_number}
                      isArchived={false}
                      hasDraft={!!(getCard(lead.row_number).message || '').trim()}
                      onSelect={onSelectLead}
                    />
                  ))}
                </div>
              )}

              {activeLeads.length === 0 && showArchived && archivedLeads.length > 0 && (
                <p className="reply-inbox-list-hint type-body-sm text-gs-muted px-4 py-3 border-b border-gs-border/60">
                  All matching conversations are archived. Open one below or restore from the detail view.
                </p>
              )}

              {showArchived && archivedLeads.length > 0 && (
                <div>
                  <p className="reply-inbox-section-label reply-inbox-section-label--archived">
                    Archived ({archivedLeads.length})
                  </p>
                  {archivedLeads.map(lead => (
                    <ReplyListItem
                      key={lead.row_number}
                      lead={lead}
                      selected={selectedRowNumber === lead.row_number}
                      isArchived
                      hasDraft={false}
                      onSelect={onSelectLead}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <main className="reply-inbox-detail" aria-label="Conversation">
        {detailOpen && (
          <div className="reply-inbox-detail-toolbar lg:hidden shrink-0">
            <button
              type="button"
              onClick={onClearSelection}
              className="reply-inbox-back btn-ghost text-xs gap-1.5"
            >
              <ChevronLeft size={16} aria-hidden />
              All replies
            </button>
          </div>
        )}
        <div className="reply-inbox-detail-inner flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
