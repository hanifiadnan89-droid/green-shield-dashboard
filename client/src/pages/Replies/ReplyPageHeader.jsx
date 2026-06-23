import { RefreshCw, Archive } from 'lucide-react';
import { motion } from 'motion/react';

export default function ReplyPageHeader({
  loading,
  archivedCount,
  archivedUnreadCount = 0,
  showArchived,
  onToggleArchived,
  onRefresh,
}) {
  return (
    <header className="rc-header rc-header--toolbar">
      <div className="rc-header__actions rc-header__actions--start">
        <span className="rc-live" aria-live="polite">
          <motion.span
            className="rc-live__dot"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          Live
        </span>
      </div>
      <div className="rc-header__actions">
        {(archivedCount > 0 || archivedUnreadCount > 0) && (
          <motion.button
            type="button"
            onClick={onToggleArchived}
            className={`rc-btn-ghost ${showArchived ? 'rc-btn-ghost--active' : ''} relative`}
            whileTap={{ scale: 0.96 }}
          >
            <Archive size={13} aria-hidden />
            {showArchived ? 'Hide archived' : `${archivedCount} archived`}
            {archivedUnreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none"
                aria-label={`${archivedUnreadCount} unread in archived`}
              >
                {archivedUnreadCount}
              </span>
            )}
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
