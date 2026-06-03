import { TEMPLATE_META } from '../CRMPreview/mockData.js';

const STATUS_CLASS = {
  active:       'leads-label--active',
  sent:         'leads-label--sent',
  replied:      'leads-label--replied',
  stopped:      'leads-label--stopped',
  stop:         'leads-label--warn',
  error:        'leads-label--warn',
  email_failed: 'leads-label--warn',
  archived:     'leads-label--muted',
  imported:     'leads-label--muted',
  yes:          'leads-label--accent',
  ag:           'leads-label--accent',
  na:           'leads-label--warn',
  rit:          'leads-label--info',
  iq:           'leads-label--purple',
  't/m':        'leads-label--pink',
  ch:           'leads-label--info',
};

function formatLabel(key, raw) {
  if (key === 'yes') return 'Replied';
  if (TEMPLATE_META[key]) return TEMPLATE_META[key].label;
  if (key === 'email_failed') return 'Email failed';
  return String(raw || key).replace(/_/g, ' ');
}

/** Clean CRM text label — no pills or bubbles */
export default function LeadStatusLabel({ value, className = '' }) {
  if (!value) {
    return <span className={`leads-label leads-label--empty ${className}`.trim()}>—</span>;
  }
  const key = value.toString().toLowerCase().trim();
  const tone = STATUS_CLASS[key] || 'leads-label--muted';
  return (
    <span className={`leads-label ${tone} ${className}`.trim()}>
      {formatLabel(key, value)}
    </span>
  );
}
