import { motion } from 'motion/react';
import { Bot, RefreshCw, Zap } from 'lucide-react';

function formatRefreshed(date) {
  if (!date) return 'Not yet synced';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FollowupsAutomationCard({ lastRefreshed, loading, onRefresh }) {
  return (
    <motion.section
      className="followups-automation"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="followups-automation__inner">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="followups-automation__badge">
              <Zap size={12} />
              Automation: Active
            </span>
            <span className="text-xs font-semibold text-gs-info flex items-center gap-1">
              <Bot size={13} />
              Managed by n8n
            </span>
          </div>
          <h2 className="followups-automation__title">Follow-up sequences run automatically</h2>
          <p className="followups-automation__desc">
            After you send a template, n8n schedules reminder touches at{' '}
            <strong>2-day</strong> and <strong>5-day</strong> intervals. Sequences auto-stop when a lead replies or{' '}
            <code className="text-xs bg-white/60 px-1 rounded">stop=yes</code> is set.
          </p>
          <div className="followups-automation__meta">
            <span>
              Last refreshed: <strong>{formatRefreshed(lastRefreshed)}</strong>
            </span>
            <span>
              Auto-stop: <strong>replies · stop=yes</strong>
            </span>
          </div>
        </div>
        <motion.button
          type="button"
          className="followups-btn-refresh shrink-0"
          onClick={onRefresh}
          disabled={loading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Sync now
        </motion.button>
      </div>
    </motion.section>
  );
}
