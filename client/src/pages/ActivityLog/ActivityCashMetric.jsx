import { DollarSign } from 'lucide-react';
import { computeUnpaidInitialMetrics } from './computeBoardMetrics.js';

export default function ActivityCashMetric({ items, loading }) {
  const metrics = computeUnpaidInitialMetrics(items);

  return (
    <section className="activity-cash-metric" aria-label="Total unpaid initial contract value">
      <div className="activity-cash-metric__icon" aria-hidden>
        <DollarSign size={18} strokeWidth={2.5} />
      </div>
      <p className="activity-cash-metric__label">Total Unpaid Initial Contract Value</p>
      <p className="activity-cash-metric__amount">
        {loading && items.length === 0 ? '…' : metrics.totalLabel}
      </p>
      <p className="activity-cash-metric__sub">
        {loading && items.length === 0 ? 'Syncing unpaid initial items…' : metrics.subtext}
      </p>
    </section>
  );
}
