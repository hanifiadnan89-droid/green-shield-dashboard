import { TEMPLATE_META } from '../CRMPreview/mockData.js';

const BADGE_CLASS = {
  active: 'lc-badge--active',
  sent: 'lc-badge--sent',
  replied: 'lc-badge--replied',
  stopped: 'lc-badge--warn',
  stop: 'lc-badge--warn',
  error: 'lc-badge--warn',
  email_failed: 'lc-badge--warn',
  archived: 'lc-badge--archived',
  imported: 'lc-badge--muted',
  yes: 'lc-badge--replied',
  ag: 'lc-badge--purple',
  na: 'lc-badge--na',
  rit: 'lc-badge--info',
  iq: 'lc-badge--purple',
  't/m': 'lc-badge--purple',
  ch: 'lc-badge--info',
};

function formatLabel(key, raw) {
  if (key === 'yes') return 'Replied';
  if (key === 'stop') return 'Stop';
  if (TEMPLATE_META[key]) return TEMPLATE_META[key].label;
  if (key === 'email_failed') return 'Email failed';
  return String(raw || key).replace(/_/g, ' ');
}

/** Status pill for dark command-center table */
export default function LeadStatusLabel({ value, className = '' }) {
  if (!value) {
    return <span className={`lc-badge lc-badge--empty ${className}`.trim()}>—</span>;
  }
  const key = value.toString().toLowerCase().trim();
  const tone = BADGE_CLASS[key] || 'lc-badge--muted';
  return (
    <span className={`lc-badge ${tone} ${className}`.trim()}>
      {formatLabel(key, value)}
    </span>
  );
}
