import { RefreshCw, Archive } from 'lucide-react';
import { motion } from 'motion/react';

export default function ReplyPageHeader({
  loading,
  archivedCount,
  showArchived,
  onToggleArchived,
  onRefresh,
}) {
  return (
    <header className="rc-header rc-header--toolbar">
      <div className="rc-header__actions">
        {archivedCount > 0 && (
          <motion.button
            type="button"
            onClick={onToggleArchived}
            className={`rc-btn-ghost ${showArchived ? 'rc-btn-ghost--active' : ''}`}
            whileTap={{ scale: 0.96 }}
          >
            <Archive size={13} aria-hidden />
            {showArchived ? 'Hide archived' : `${archivedCount} archived`}
          </motion.button>
        )}
        <motion.button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="rc-btn-ghost"
          whileTap={{ scale: 0.96 }}
          aria-label="Refresh conversations"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden />
          Refresh
        </motion.button>
      </div>
    </header>
  );
}
