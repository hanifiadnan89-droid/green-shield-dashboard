import { motion } from 'motion/react';
import { User, Search } from 'lucide-react';

export default function LeadsEmptyState({ search, categoryMeta }) {
  const Icon = search ? Search : User;

  return (
    <motion.div
      className="leads-empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="leads-empty__icon">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold text-gs-text mb-1">No leads found</h3>
      <p className="text-sm text-gs-muted max-w-sm">
        {search
          ? 'Try adjusting your search or clearing filters to see more results.'
          : categoryMeta
            ? `No leads match the "${categoryMeta.label}" view right now.`
            : 'Your lead sheet is empty. New leads will appear here when added.'}
      </p>
    </motion.div>
  );
}
