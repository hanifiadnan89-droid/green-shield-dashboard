import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BarChart3, X } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

function UsageRow({ label, value, highlight = false }) {
  return (
    <div className={`intake-rentcast-usage__row${highlight ? ' intake-rentcast-usage__row--highlight' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function IntakeRentCastUsageModal({
  open,
  usage,
  loading = false,
  error = null,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const overage = usage?.estimatedOverageCalls > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="intake-rentcast-modal__backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          onClick={onClose}
        >
          <motion.div
            className="intake-rentcast-modal intake-rentcast-modal--usage"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intake-rentcast-usage-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.22, ease: EASE }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="intake-rentcast-modal__header">
              <div className="intake-rentcast-modal__header-title">
                <BarChart3 size={18} />
                <h2 id="intake-rentcast-usage-title">RentCast API Usage</h2>
              </div>
              <button type="button" className="intake-rentcast-modal__close" onClick={onClose} aria-label="Close">
                <X size={16} />
              </button>
            </header>

            {loading && <p className="intake-rentcast-modal__body">Loading usage…</p>}
            {error && <p className="intake-rentcast-modal__error">{error}</p>}

            {!loading && usage && (
              <div className="intake-rentcast-usage">
                <UsageRow label="Billing month" value={usage.monthKey} />
                <UsageRow label="Calls made this month" value={usage.callsMadeThisMonth} />
                <UsageRow
                  label="Estimated free calls remaining"
                  value={usage.estimatedFreeRemaining}
                  highlight={usage.estimatedFreeRemaining <= 5}
                />
                <UsageRow label="Estimated free tier" value={`${usage.estimatedFreeTierMonthly} / month`} />
                {usage.monthlyLookupLimit != null && usage.monthlyLookupLimit > 0 && (
                  <UsageRow label="Server hard cap" value={usage.monthlyLookupLimit} />
                )}
                {overage && (
                  <p className="intake-rentcast-modal__warning">
                    Estimated overage: {usage.estimatedOverageCalls} paid lookup{usage.estimatedOverageCalls === 1 ? '' : 's'} beyond the free tier.
                  </p>
                )}
                {!usage.rentCastUsageApiAvailable && (
                  <p className="intake-rentcast-usage__footnote">
                    RentCast does not expose live billing usage via API. Counts are tracked locally on this server.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
