import { getLeadPipelineStatus } from './getLeadPipelineStatus.js';

const LABELS = {
  error: 'Error',
  stopped: 'Stopped',
  replied: 'Replied',
  in_progress: 'In Progress',
  new: 'New',
};

const DOT_STATUSES = new Set(['error', 'replied']);

export default function LeadPipelineStatusPill({ lead }) {
  const status = getLeadPipelineStatus(lead);
  const showDot = DOT_STATUSES.has(status);

  return (
    <span className={`lead-status-pill lead-status-pill--${status}`}>
      {showDot && (
        <span
          className={`lead-status-pill__dot${status === 'error' ? ' lead-status-pill__dot--pulse' : ''}`}
          aria-hidden
        />
      )}
      {LABELS[status]}
    </span>
  );
}
