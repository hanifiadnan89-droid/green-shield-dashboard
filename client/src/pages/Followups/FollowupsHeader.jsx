import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';

export default function FollowupsHeader({ loading, onRefresh, inFlightCount }) {
  return (
    <motion.header
      className="followups-header"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <h1 className="followups-header__title">Follow-ups</h1>
        <p className="followups-header__sub">
          Automation command center — monitor active sequences, overdue touches, and leads that need your attention.
          {inFlightCount > 0 && (
            <span className="text-gs-accent-dim font-medium"> {inFlightCount} in flight.</span>
          )}
        </p>
      </div>
      <motion.button
        type="button"
        className="followups-btn-refresh"
        onClick={onRefresh}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        Refresh
      </motion.button>
    </motion.header>
  );
}
