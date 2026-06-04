import { deriveDisplayStatus } from './followupsUtils.js';

const STATUS_LABELS = {
  error: 'Needs action',
};

export default function FollowupStatusLabel({ lead, days }) {
  const { key, label } = deriveDisplayStatus(lead, days);
  const display = STATUS_LABELS[key] || label;

  return (
    <span className={`fc-status fc-status--${key}`}>
      <span className="fc-status__dot" aria-hidden />
      {display}
    </span>
  );
}
