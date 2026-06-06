export default function RouteFinderTrustBadges({ badges = [], compact = true }) {
  if (!badges.length) return null;

  const visible = compact ? badges.slice(0, 3) : badges;
  const extra = compact && badges.length > 3 ? badges.length - 3 : 0;

  return (
    <div className="rf-trust-badges">
      {visible.map(badge => (
        <span key={badge} className="rf-trust-badge">{badge}</span>
      ))}
      {extra > 0 && (
        <span className="rf-trust-badge rf-trust-badge--more">+{extra}</span>
      )}
    </div>
  );
}
