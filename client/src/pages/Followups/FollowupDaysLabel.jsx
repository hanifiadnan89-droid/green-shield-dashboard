function displayTier(days) {
  if (days === null) return 'muted';
  if (days <= 1) return 'fresh';
  if (days <= 3) return 'mild';
  if (days <= 6) return 'warm';
  return 'critical';
}

function formatDaysLabel(days) {
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function FollowupDaysLabel({ days }) {
  if (days === null) {
    return <span className="followups-days followups-days--muted">—</span>;
  }

  const tier = displayTier(days);
  return (
    <span className={`followups-days followups-days--${tier}`}>
      {formatDaysLabel(days)}
    </span>
  );
}
