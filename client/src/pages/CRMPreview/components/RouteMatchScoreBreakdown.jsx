import { SCORE_BREAKDOWN } from './RouteFinder/routeMatchCardConfig.js';

function barColor(v) {
  if (v >= 70) return '#16A34A';
  if (v >= 45) return '#F59E0B';
  return '#94A3B8';
}

export default function RouteMatchScoreBreakdown({ scores, rows = SCORE_BREAKDOWN }) {
  return (
    <ul className="route-match-score-bars">
      {rows.map(({ key, label }) => {
        const v = scores[key] ?? 0;
        const color = barColor(v);
        return (
          <li key={key} className="route-match-score-bars__row">
            <div className="route-match-score-bars__head">
              <span>{label}</span>
              <span className="route-match-score-bars__value" style={{ color }}>{v}</span>
            </div>
            <div className="route-match-score-bars__track">
              <div
                className="route-match-score-bars__fill"
                style={{ width: `${Math.min(100, Math.max(0, v))}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
