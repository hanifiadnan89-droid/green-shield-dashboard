import { MessageCircle, RefreshCw, Archive } from 'lucide-react';

export default function ReplyPageHeader({
  loading,
  leadsCount,
  archivedCount,
  showArchived,
  onToggleArchived,
  onRefresh,
}) {
  return (
    <div className="reply-page-header">
      <div>
        <h1 className="type-heading-lg text-gs-text flex items-center gap-2">
          <MessageCircle size={18} className="text-gs-accent" />
          SMS Replies
        </h1>
        <p className="type-body-sm text-gs-muted mt-0.5">
          {loading
            ? 'Loading…'
            : `${leadsCount} customer${leadsCount !== 1 ? 's' : ''} with inbound replies`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {archivedCount > 0 && (
          <button
            type="button"
            onClick={onToggleArchived}
            className={`btn-ghost text-xs gap-1.5 ${showArchived ? 'text-violet-700' : ''}`}
          >
            <Archive size={13} />
            {showArchived ? 'Hide archived' : `${archivedCount} archived`}
          </button>
        )}
        <button type="button" onClick={onRefresh} disabled={loading} className="btn-ghost text-xs gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}
