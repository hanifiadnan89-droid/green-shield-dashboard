import { motion } from 'motion/react';
import { Search, Users } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

export function EmptyLeadListState() {
  return (
    <motion.div
      className="send-lead-empty"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="send-lead-empty__icon">
        <Users size={24} />
      </div>
      <p className="type-body-sm font-semibold text-gs-text">No leads loaded</p>
      <p className="type-label-sm text-gs-muted font-normal tracking-normal mt-1 max-w-xs">
        Leads from your sheet will appear here when available.
      </p>
    </motion.div>
  );
}

export function EmptySearchState({ query }) {
  return (
    <motion.div
      className="send-lead-empty py-12"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      <div className="send-lead-empty__icon">
        <Search size={22} />
      </div>
      <p className="type-body-sm font-semibold text-gs-text">No matches</p>
      <p className="type-label-sm text-gs-muted font-normal tracking-normal mt-1 max-w-xs">
        Nothing matches &ldquo;{query}&rdquo;. Try another name, phone, or email.
      </p>
    </motion.div>
  );
}

export function EmptyPreviewState() {
  return (
    <motion.div
      className="send-lead-empty flex-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className="send-lead-empty__icon">
        <Users size={24} />
      </div>
      <p className="type-body-sm font-semibold text-gs-text">Preview a lead</p>
      <p className="type-label-sm text-gs-muted font-normal tracking-normal mt-1 max-w-[260px]">
        Hover or focus a lead in the list to see contact details, status, and template readiness here.
      </p>
    </motion.div>
  );
}
