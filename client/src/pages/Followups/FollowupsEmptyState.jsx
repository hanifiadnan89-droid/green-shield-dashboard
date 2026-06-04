import { motion } from 'motion/react';
import { Clock, Inbox, Search } from 'lucide-react';

export default function FollowupsEmptyState({ filterLabel, search }) {
  const hasSearch = Boolean(search?.trim());

  return (
    <motion.div
      className="followups-empty"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="followups-empty__icon">
        {hasSearch ? <Search size={26} /> : filterLabel === 'All' ? <Clock size={26} /> : <Inbox size={26} />}
      </div>
      <h3>No follow-ups in this view</h3>
      <p>
        {hasSearch
          ? `No results for “${search.trim()}”. Try a different search or clear filters.`
          : filterLabel === 'All'
            ? 'All sent leads have either replied or been stopped. New sequences appear here after you send a template.'
            : `No leads match the “${filterLabel}” filter right now. Try another view or refresh.`}
      </p>
    </motion.div>
  );
}
