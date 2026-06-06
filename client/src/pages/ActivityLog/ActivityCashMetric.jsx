import { forwardRef } from 'react';
import { AlertTriangle, CheckCircle2, TrendingDown } from 'lucide-react';
import { formatLostValue } from './computeBoardMetrics.js';

const ActivityCashMetric = forwardRef(function ActivityCashMetric({
  displayLostValue = 0,
  activeCount = 0,
  loading,
  isRecovering,
  allResolved,
}, ref) {
  const isAtRisk = displayLostValue > 0;
  const showSuccess = allResolved && !loading;

  const metricClass = [
    'activity-cash-metric',
    showSuccess ? 'activity-cash-metric--success' : 'activity-cash-metric--at-risk',
    isRecovering ? 'activity-cash-metric--recovering' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={metricClass} aria-label="Lost contract value at risk">
      <div className="activity-cash-metric__icon" aria-hidden>
        {showSuccess
          ? <CheckCircle2 size={15} strokeWidth={2.5} />
          : isAtRisk
            ? <TrendingDown size={15} strokeWidth={2.5} />
            : <AlertTriangle size={15} strokeWidth={2.5} />}
      </div>
      <p className="activity-cash-metric__label">
        {showSuccess ? 'Revenue Recovery Complete' : 'Lost Contract Value'}
      </p>
      <p ref={ref} className="activity-cash-metric__amount">
        {loading && activeCount === 0 && !showSuccess
          ? '…'
          : formatLostValue(displayLostValue)}
      </p>
      <p className="activity-cash-metric__sub">
        {loading && activeCount === 0 && !showSuccess
          ? 'Syncing error board…'
          : showSuccess
            ? 'All errors resolved · No revenue at risk'
            : activeCount === 0
              ? 'No revenue at risk'
              : activeCount === 1
                ? '1 active error · money left on the table'
                : `${activeCount} active errors · money left on the table`}
      </p>
    </section>
  );
});

export default ActivityCashMetric;
