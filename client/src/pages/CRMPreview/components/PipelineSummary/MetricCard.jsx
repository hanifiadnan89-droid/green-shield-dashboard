import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedNumber from './AnimatedNumber.jsx';
import { formatPercent } from './formatPercent.js';
import { SPARKLINES, SPARK_DURATIONS } from './sparkPaths.js';

const MetricCard = memo(function MetricCard({ metric, value, rate }) {
  const navigate = useNavigate();
  const { Icon } = metric;

  return (
    <button
      type="button"
      className={`ps-metric-card ps-metric-card--${metric.key}`}
      style={{ '--mc': metric.color }}
      onClick={() => navigate('/leads')}
    >
      <span className="ps-metric-card__icon">
        <Icon size={20} />
      </span>
      <span className="ps-metric-card__body">
        <span className="ps-metric-card__label">{metric.label}</span>
        <span className="ps-metric-card__row">
          <AnimatedNumber value={value} className="ps-metric-card__value" />
          {rate != null && (
            <span className="ps-metric-card__rate">{formatPercent(rate)}</span>
          )}
        </span>
      </span>
      <svg className="ps-metric-card__spark" viewBox="0 0 96 36" aria-hidden="true">
        <path d={SPARKLINES[metric.key]} className="ps-metric-card__spark-path">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="-96 0"
            dur={`${SPARK_DURATIONS[metric.key]}s`}
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </button>
  );
});

export default MetricCard;
