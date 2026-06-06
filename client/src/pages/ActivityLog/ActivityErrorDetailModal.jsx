import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import Spinner from '../../components/Spinner.jsx';

const EASE = [0.22, 1, 0.36, 1];

function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div className="activity-error-modal__row">
      <span className="activity-error-modal__label">{label}</span>
      <span className="activity-error-modal__value">{value}</span>
    </div>
  );
}

export default function ActivityErrorDetailModal({
  item,
  completing,
  onClose,
  onComplete,
}) {
  useEffect(() => {
    if (!item) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="activity-error-modal__backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: EASE }}
          onClick={onClose}
        >
          <motion.div
            className="activity-error-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-error-modal-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.24, ease: EASE }}
            onClick={e => e.stopPropagation()}
          >
            <header className="activity-error-modal__header">
              <h2 id="activity-error-modal-title" className="activity-error-modal__title">
                {item.customerName || 'Unknown customer'}
              </h2>
              <span className="activity-error-modal__badge">{item.status || 'Open'}</span>
            </header>

            <div className="activity-error-modal__body">
              <DetailRow label="Customer name" value={item.customerName} />
              <DetailRow label="Account number" value={item.customerId} />
              <DetailRow label="Reason (Column F)" value={item.reasonDisplay || item.reasonRaw || item.reason} />
              <DetailRow label="Notes (Column G)" value={item.notesText || item.notes} />
              <DetailRow label="Detected service" value={item.detectedServiceLabel || item.detectedServiceType} />
              <DetailRow label="Detected error type" value={item.detectedErrorType || item.errorType} />
              <DetailRow label="Original price" value={item.originalPriceLabel} />
              <DetailRow
                label="Estimated contract value"
                value={item.isEstimated
                  ? `${item.contractValueLabel} (estimated)`
                  : item.contractValueLabel}
              />
              <DetailRow label="Summary" value={item.cardSummary} />
              <DetailRow label="Date added" value={item.dateAdded} />
              <DetailRow label="Added by" value={item.addedBy} />
              <DetailRow label="Sales rep" value={item.initials} />
              <DetailRow label="Date addressed" value={item.dateAddressed} />
              <DetailRow label="Loss" value={item.loss} />
              <DetailRow
                label="Status"
                value={item.isComplete ? 'Complete' : 'Not Complete'}
              />
            </div>

            <footer className="activity-error-modal__footer">
              <button
                type="button"
                className="activity-error-modal__cta"
                disabled={completing}
                onClick={() => onComplete(item)}
              >
                {completing
                  ? <><Spinner size={14} /> Marking complete…</>
                  : <><Check size={15} /> Mark Complete</>}
              </button>
              <button type="button" className="activity-error-modal__ghost" onClick={onClose}>
                <X size={15} />
                Close
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
