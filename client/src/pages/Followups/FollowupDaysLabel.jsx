import { getUrgencyTier } from './followupsUtils.js';

export default function FollowupDaysLabel({ days }) {
  if (days === null) {
    return <span className="followups-label followups-label--muted">—</span>;
  }
  const tier = getUrgencyTier(days);
  return (
    <span className={`followups-days followups-days--${tier}`}>
      {days}d ago
    </span>
  );
}
