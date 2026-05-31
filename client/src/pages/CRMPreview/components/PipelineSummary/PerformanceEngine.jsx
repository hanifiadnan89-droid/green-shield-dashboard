import { memo } from 'react';
import { Activity } from 'lucide-react';
import { RING_DEFS } from './constants.js';
import RingCard from './RingCard.jsx';

const PerformanceEngine = memo(function PerformanceEngine({ rates }) {
  return (
    <section className="ps-panel ps-panel--left">
      <div className="ps-panel__head">
        <Activity size={14} />
        <span>Performance Engine</span>
      </div>
      <div className="ps-rings-stack">
        {RING_DEFS.map(def => (
          <RingCard key={def.key} def={def} pct={rates[def.rateKey] ?? 0} />
        ))}
      </div>
      <div className="ps-rings-legend">
        {RING_DEFS.map(def => (
          <span
            key={def.key}
            className="ps-rings-legend__item"
            style={{ '--lc': def.color }}
          >
            <i />{def.label}
          </span>
        ))}
      </div>
    </section>
  );
});

export default PerformanceEngine;
