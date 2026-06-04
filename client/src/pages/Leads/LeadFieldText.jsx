import { TEMPLATE_META } from '../CRMPreview/mockData.js';

function formatStatusText(value) {
  const key = String(value || '').toLowerCase().trim();
  if (!key) return '—';
  if (key === 'yes') return 'replied';
  if (key === 'email_failed') return 'email failed';
  return key.replace(/_/g, ' ');
}

function formatNoteText(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.toLowerCase();
}

/**
 * Plain table/detail text — no pills or badges.
 * @param {{ value?: string; kind?: 'note' | 'status' | 'stop' | 'flag'; className?: string }} props
 */
export default function LeadFieldText({ value, kind = 'status', className = '' }) {
  if (!value && kind !== 'stop') {
    return <span className={`lc-field lc-field--empty ${className}`.trim()}>—</span>;
  }

  if (kind === 'note') {
    return (
      <span className={`lc-field lc-field--note ${className}`.trim()}>
        {formatNoteText(value)}
      </span>
    );
  }

  if (kind === 'stop') {
    if (value !== 'yes') return null;
    return <span className={`lc-field lc-field--muted ${className}`.trim()}>stop</span>;
  }

  if (kind === 'flag') {
    return <span className={`lc-field lc-field--accent ${className}`.trim()}>replied</span>;
  }

  return (
    <span className={`lc-field lc-field--status ${className}`.trim()}>
      {formatStatusText(value)}
    </span>
  );
}

/** Human-readable note label for detail panel (still lowercase). */
export function formatNoteLabel(value) {
  const key = String(value || '').toLowerCase().trim();
  if (!key) return '—';
  if (TEMPLATE_META[key]) return key;
  return key;
}

export function formatStatusLabel(value) {
  return formatStatusText(value);
}
