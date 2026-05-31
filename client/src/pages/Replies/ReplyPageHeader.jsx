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
    <div
      className="px-6 py-5 bg-gs-bg border-b border-gs-border flex items-center justify-between sticky top-0 z-10"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(243,247,241,0.92)' }}
    >
      <div>
        <h1 className="text-lg font-bold text-gs-text flex items-center gap-2">
          <MessageCircle size={18} className="text-gs-accent" />
          SMS Replies
        </h1>
        <p className="text-gs-muted text-xs mt-0.5">
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
            className="btn-ghost text-xs gap-1.5"
            style={{ color: showArchived ? '#7C3AED' : undefined }}
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
