import { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  buildFollowupKpiSparkline,
  formatKpiTrend,
  sparklineWeekDelta,
} from './followupsKpiAnalytics.js';
import { sparklinePath } from '../Leads/leadsSparkline.js';

const CARDS = [
  { key: 'active', label: 'Active Follow-ups', accent: 'green', metric: 'active' },
  { key: 'overdue', label: 'Overdue', accent: 'red', metric: 'overdue' },
  { key: 'stopped', label: 'Stopped', accent: 'blue', metric: 'stopped' },
  { key: 'replied', label: 'Replies Received', accent: 'purple', metric: 'replied' },
  { key: 'avgDays', label: 'Avg Days Since Sent', accent: 'green', metric: 'avgDays', suffix: 'd' },
];

function AnimatedValue({ value, suffix }) {
  const display = suffix ? `${value}${suffix}` : String(value);
  return (
    <motion.p
      key={display}
      className="fc-kpi-card__value"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {display}
    </motion.p>
  );
}

export default function FollowupsKpiRow({ kpis, loading, allLeads, inFlightLeads }) {
  const sparklines = useMemo(() => {
    const out = {};
    for (const card of CARDS) {
      out[card.metric] = buildFollowupKpiSparkline(allLeads, inFlightLeads, card.metric, 7);
    }
    return out;
  }, [allLeads, inFlightLeads]);

  return (
    <div className="fc-kpi-grid">
      {CARDS.map((card, i) => {
        const raw = kpis[card.key];
        const values = sparklines[card.metric] || [];
        const delta = sparklineWeekDelta(values);
        const trend = formatKpiTrend(card.metric, delta, raw);
        const sparkD = sparklinePath(values);

        const displayValue = loading
          ? '—'
          : card.key === 'avgDays'
            ? raw
            : raw;

        return (
          <motion.article
            key={card.key}
            className={`fc-kpi-card fc-kpi-card--${card.accent}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 + i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
          >
            <p className="fc-kpi-card__label">{card.label}</p>
            {loading ? (
              <p className="fc-kpi-card__value">—</p>
            ) : (
              <AnimatedValue value={displayValue} suffix={card.suffix} />
            )}
            <div className="fc-kpi-card__footer">
              <span className={`fc-kpi-card__trend fc-kpi-card__trend--${trend.direction}`}>
                {loading ? '…' : trend.text}
              </span>
              <svg
                className="fc-kpi-card__spark"
                width="72"
                height="22"
                viewBox="0 0 88 28"
                aria-hidden
              >
                <path d={sparkD} />
              </svg>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}
