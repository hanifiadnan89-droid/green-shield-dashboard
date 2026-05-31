import { memo } from 'react';
import { formatPercent } from './formatPercent.js';

const RingCard = memo(function RingCard({ def, pct }) {
  const r = 38;
  const sw = 5;
  const circ = 2 * Math.PI * r;
  const arc = (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  const dashArray = `${arc} ${circ - arc}`;
  const dashOffset = circ * 0.25;
  const { Icon } = def;

  return (
    <div className="ps-ring-card">
      <div className="ps-ring-card__dial">
        <svg
          className="ps-ring-card__svg"
          viewBox="0 0 96 96"
          width={96}
          height={96}
          aria-hidden="true"
        >
          <circle
            cx={48}
            cy={48}
            r={r}
            fill="none"
            stroke="rgba(203,213,225,0.40)"
            strokeWidth={sw}
          />
          <circle
            cx={48}
            cy={48}
            r={r}
            fill="none"
            stroke={def.color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            className="ps-ring-card__arc"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '48px 48px' }}
          />
        </svg>
        <div className="ps-ring-card__icon" style={{ color: def.color }}>
          <Icon size={18} />
        </div>
      </div>
      <div className="ps-ring-card__info">
        <span className="ps-ring-card__label">{def.label}</span>
        <span className="ps-ring-card__pct" style={{ color: def.color }}>
          {formatPercent(pct)}
        </span>
      </div>
    </div>
  );
});

export default RingCard;
