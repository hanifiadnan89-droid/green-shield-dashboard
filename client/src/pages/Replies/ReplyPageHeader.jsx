import { MessageCircle, RefreshCw, Archive } from 'lucide-react';
import { motion } from 'motion/react';

export default function ReplyPageHeader({
  loading,
  leadsCount,
  archivedCount,
  showArchived,
  onToggleArchived,
  onRefresh,
}) {
  return (
    <div className="replies-page-header">
      <div>
        <h1 className="type-heading-lg text-gs-text flex items-center gap-2 m-0">
          <MessageCircle size={20} className="text-gs-accent" />
          Replies
        </h1>
        <p className="type-body-sm text-gs-muted mt-1 m-0">
          {loading
            ? 'Loading conversations…'
            : `${leadsCount} conversation${leadsCount !== 1 ? 's' : ''} · SMS & email history`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {archivedCount > 0 && (
          <motion.button
            type="button"
            onClick={onToggleArchived}
            className={`btn-ghost text-xs gap-1.5 ${showArchived ? 'text-violet-700' : ''}`}
            whileTap={{ scale: 0.96 }}
          >
            <Archive size={13} />
            {showArchived ? 'Hide archived' : `${archivedCount} archived`}
          </motion.button>
        )}
        <motion.button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="btn-ghost text-xs gap-1.5"
          whileTap={{ scale: 0.96 }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </motion.button>
      </div>
    </div>
  );
}
