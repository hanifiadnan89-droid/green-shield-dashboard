import { deriveDisplayStatus } from './followupsUtils.js';

export default function FollowupStatusLabel({ lead, days }) {
  const { key, label } = deriveDisplayStatus(lead, days);
  return (
    <span className={`followups-label followups-label--${key}`}>
      {label}
    </span>
  );
}
