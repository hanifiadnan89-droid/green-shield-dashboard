import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

export default function IntakeRentCastConfirmModal({
  open,
  usage,
  onCancel,
  onConfirm,
  confirming = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="intake-rentcast-modal__backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={onCancel}
        >
          <motion.div
            className="intake-rentcast-modal intake-rentcast-modal--confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intake-rentcast-confirm-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.22, ease: EASE }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="intake-rentcast-modal__icon-wrap intake-rentcast-modal__icon-wrap--warning">
              <AlertTriangle size={20} />
            </div>
            <h2 id="intake-rentcast-confirm-title" className="intake-rentcast-modal__title">
              Paid property lookup
            </h2>
            <p className="intake-rentcast-modal__body">
              Estimated free RentCast lookups for {usage?.monthKey || 'this month'} are used up
              ({usage?.callsMadeThisMonth ?? 0} of {usage?.estimatedFreeTierMonthly ?? 50}).
              Continuing will use a paid API call.
            </p>
            {usage?.estimatedOverageCalls > 0 && (
              <p className="intake-rentcast-modal__warning">
                You are already {usage.estimatedOverageCalls} call{usage.estimatedOverageCalls === 1 ? '' : 's'} into estimated overage billing.
              </p>
            )}
            <div className="intake-rentcast-modal__actions">
              <button type="button" className="intake-secondary-btn" onClick={onCancel} disabled={confirming}>
                Cancel
              </button>
              <button type="button" className="intake-primary-btn" onClick={onConfirm} disabled={confirming}>
                {confirming ? 'Looking up…' : 'Confirm paid lookup'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
