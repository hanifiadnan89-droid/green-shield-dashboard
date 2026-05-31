import { memo } from 'react';
import { BarChart3 } from 'lucide-react';
import { METRIC_DEFS } from './constants.js';
import MetricCard from './MetricCard.jsx';

const KeyMetrics = memo(function KeyMetrics({ metrics, rates }) {
  return (
    <section className="ps-panel ps-panel--right">
      <div className="ps-panel__head">
        <BarChart3 size={14} />
        <span>Key Metrics</span>
      </div>
      <div className="ps-metrics-stack">
        {METRIC_DEFS.map(metric => {
          const value = metrics[metric.valueKey] ?? 0;
          const rate = metric.rateKey != null ? (rates[metric.rateKey] ?? null) : null;
          return (
            <MetricCard key={metric.key} metric={metric} value={value} rate={rate} />
          );
        })}
      </div>
    </section>
  );
});

export default KeyMetrics;
