export default function RouteFinderCostImpact({ costImpact, compact = true }) {
  if (!costImpact) return null;

  return (
    <div className={`rf-cost-impact${compact ? '' : ' rf-cost-impact--expanded'}`}>
      <div className="rf-cost-impact__row">
        <span className="rf-cost-impact__label">Added route cost</span>
        <span className="rf-cost-impact__value">{costImpact.summary}</span>
      </div>
      {!compact && (
        <p className="rf-cost-impact__detail">{costImpact.detail}</p>
      )}
      <div className="rf-cost-impact__meta">
        <span>+{costImpact.addedDriveMinutes} min drive</span>
        <span>·</span>
        <span>+{costImpact.addedMiles} mi</span>
        {costImpact.efficiencyLabel && (
          <>
            <span>·</span>
            <span className="rf-cost-impact__efficiency" data-tier={costImpact.efficiencyKey}>
              {costImpact.efficiencyLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
