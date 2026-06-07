export default function RouteTravelBadges({
  travelDiagnostics,
  mapPolyline,
  compact = false,
}) {
  const timingRoad = travelDiagnostics?.travelProvider === 'google-routes'
    && !travelDiagnostics?.fallbackUsed;
  const mapRoad = mapPolyline?.provider === 'google-routes'
    && mapPolyline?.encodedPolyline
    && !mapPolyline?.fallbackUsed;

  const badges = [];

  if (timingRoad) {
    badges.push({ key: 'timing-road', label: 'Road-based timing', tone: 'good' });
  } else {
    badges.push({ key: 'timing-est', label: 'Estimated straight-line timing', tone: 'warn' });
  }

  if (mapPolyline?.loading) {
    badges.push({ key: 'map-loading', label: 'Loading road route…', tone: 'muted' });
  } else if (mapRoad) {
    badges.push({ key: 'map-road', label: 'Google road route', tone: 'good' });
  } else {
    badges.push({ key: 'map-est', label: 'Straight-line visual route', tone: 'warn' });
  }

  return (
    <div className={`rf-travel-badges${compact ? ' rf-travel-badges--compact' : ''}`}>
      {badges.map(b => (
        <span key={b.key} className={`rf-travel-badge rf-travel-badge--${b.tone}`}>
          {b.label}
        </span>
      ))}
      {!timingRoad && travelDiagnostics?.fallbackReason && !compact && (
        <p className="rf-travel-badges__note m-0">
          Road-based drive time unavailable; using estimated straight-line distance.
          {travelDiagnostics.fallbackReason === 'missing_api_key' && ' (GOOGLE_ROUTES_API_KEY not configured on server.)'}
        </p>
      )}
      {mapPolyline?.fallbackUsed && mapPolyline?.warnings?.[0] && !compact && (
        <p className="rf-travel-badges__note m-0">{mapPolyline.warnings[0]}</p>
      )}
    </div>
  );
}
