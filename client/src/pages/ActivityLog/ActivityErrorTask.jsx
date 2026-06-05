import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Check, X } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

const EASE = [0.22, 1, 0.36, 1];

export default function ActivityErrorTask({ item, completing, onComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function handleComplete() {
    setActionError(null);
    try {
      await onComplete(item.rowNumber);
      setExpanded(false);
    } catch (err) {
      setActionError(err.message || 'Could not complete task');
    }
  }

  return (
    <motion.div
      layout
      className="bg-gs-card border rounded-xl overflow-hidden transition-shadow hover:shadow-card-lift border-l-4 border-l-gs-danger border-gs-danger/20"
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full p-4 flex items-start gap-3 text-left cursor-pointer"
        aria-expanded={expanded}
      >
        <div className="w-8 h-8 rounded-full bg-gs-danger/12 border border-gs-danger/30 flex items-center justify-center shrink-0">
          <AlertCircle size={15} className="text-gs-danger" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gs-danger">
                Open error task
              </p>
              <p className="text-gs-text font-semibold text-sm mt-0.5">
                {item.label}
              </p>
            </div>
            <span className="text-[10px] font-mono text-gs-muted shrink-0">
              Row {item.rowNumber}
            </span>
          </div>
          <p className="text-gs-muted text-xs mt-1">
            Assigned to {item.initials} · Tap to update status
          </p>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="actions"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-gs-border/60">
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={completing === item.rowNumber}
                  className="btn-primary text-xs gap-1.5"
                >
                  {completing === item.rowNumber
                    ? <><Spinner size={12} /> Completing…</>
                    : <><Check size={13} /> Complete</>}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="btn-ghost text-xs gap-1.5"
                >
                  <X size={13} /> Not Complete
                </button>
              </div>
              {actionError && (
                <p className="text-gs-danger text-xs mt-2 bg-gs-danger/8 border border-gs-danger/20 rounded px-2 py-1">
                  {actionError}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
