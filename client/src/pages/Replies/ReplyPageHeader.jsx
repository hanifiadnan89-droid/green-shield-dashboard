import { MessageCircle, RefreshCw, Archive, Sparkles } from 'lucide-react';
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
    <header className="rc-header">
      <div>
        <h1 className="rc-header__title">
          <motion.span
            className="rc-header__pulse-icon inline-flex"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MessageCircle size={22} aria-hidden />
          </motion.span>
          Replies
        </h1>
        <p className="rc-header__sub">
          {loading
            ? 'Loading conversations…'
            : `${leadsCount} conversation${leadsCount !== 1 ? 's' : ''} · AI communications center`}
        </p>
      </div>
      <div className="rc-header__actions">
        <span className="rc-live" aria-live="polite">
          <span className="rc-live__dot" />
          Live
        </span>
        <span className="rc-ai-online hidden sm:inline-flex">
          <Sparkles size={10} aria-hidden />
          AI online
        </span>
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
