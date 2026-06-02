import { useMemo } from 'react';

function projectPoints(stops) {
  const withCoords = (stops || []).filter(s => s.lat != null && s.lng != null);
  if (withCoords.length === 0) return { points: [], path: '' };

  const lats = withCoords.map(s => s.lat);
  const lngs = withCoords.map(s => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = (maxLat - minLat) * 0.12 || 0.02;
  const padLng = (maxLng - minLng) * 0.12 || 0.02;

  const points = withCoords.map((s, i) => {
    const x = ((s.lng - minLng + padLng) / (maxLng - minLng + padLng * 2)) * 100;
    const y = (1 - (s.lat - minLat + padLat) / (maxLat - minLat + padLat * 2)) * 100;
    return { x, y, isNew: s.isNew, index: i + 1 };
  });

  const path = points.length
    ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`
    : '';
  return { points, path };
}

export default function RouteMatchMapPreview({ stops }) {
  const { points, path } = useMemo(() => projectPoints(stops), [stops]);

  if (!points.length) {
    return (
      <div className="route-match-map route-match-map--empty">
        <span className="type-label-sm text-gs-muted">Map preview unavailable</span>
      </div>
    );
  }

  return (
    <div className="route-match-map">
      <svg viewBox="0 0 100 100" className="route-match-map__svg" role="img" aria-label="Route map preview">
        {path && <path d={path} className="route-match-map__path" fill="none" />}
        {points.map(p => (
          <g key={`${p.x}-${p.y}-${p.index}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={p.isNew ? 4.2 : 3.2}
              className={p.isNew ? 'route-match-map__pin route-match-map__pin--new' : 'route-match-map__pin'}
            />
            <text x={p.x} y={p.y - 5} textAnchor="middle" className="route-match-map__label">
              {p.isNew ? 'N' : p.index}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
