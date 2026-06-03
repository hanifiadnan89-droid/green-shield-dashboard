import { motion } from 'motion/react';
import { Clock, Inbox } from 'lucide-react';

export default function FollowupsEmptyState({ filterLabel }) {
  return (
    <motion.div
      className="followups-empty"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="w-14 h-14 rounded-2xl bg-gs-accent/10 border border-gs-accent/20 flex items-center justify-center mb-4">
        {filterLabel === 'All' ? <Clock size={26} className="text-gs-accent" /> : <Inbox size={26} className="text-gs-muted" />}
      </div>
      <h3 className="text-lg font-bold text-gs-text">No follow-ups in this view</h3>
      <p className="text-sm text-gs-muted mt-2 max-w-sm">
        {filterLabel === 'All'
          ? 'All sent leads have either replied or been stopped. New sequences appear here after you send a template.'
          : `No leads match the “${filterLabel}” filter right now. Try another view or refresh.`}
      </p>
    </motion.div>
  );
}
