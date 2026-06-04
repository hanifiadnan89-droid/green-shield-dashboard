import { getActivityMeta } from '../CRMPreview/mockData.js';

function parseTs(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Rich relationship timeline for the lead workspace.
 */
export function buildLeadTimeline(lead, activity = [], thread = [], insights = {}) {
  const items = [];

  for (const msg of thread || []) {
    const isIn = msg.dir === 'in' || msg.direction === 'inbound';
    const isEmail = (msg.channel || '').toLowerCase() === 'email';
    const isTemplate = msg.isTemplate || msg.meta?.isTemplate;

    let label = 'SMS sent';
    if (isIn) label = 'Reply received';
    else if (isTemplate) label = 'Template sent';
    else if (isEmail) label = 'Email sent';

    items.push({
      id: `msg-${msg.id}`,
      ts: msg.ts,
      label,
      detail: msg.text || msg.body || '',
      tone: isIn ? 'in' : 'out',
    });
  }

  for (const entry of activity || []) {
    const meta = getActivityMeta(entry.action || '');
    const action = (entry.action || '').toLowerCase();
    let label = meta.label;
    if (action.includes('email')) label = 'Email sent';
    else if (action.includes('sms')) label = 'SMS sent';
    else if (action.includes('template')) label = 'Template sent';

    items.push({
      id: `act-${entry.id}`,
      ts: entry.timestamp,
      label,
      detail: entry.template ? `Template: ${entry.template}` : entry.leadName,
      tone: entry.status === 'error' ? 'error' : 'activity',
    });
  }

  if (lead.sent === 'imported') {
    items.push({
      id: 'sys-imported',
      ts: lead.sent,
      label: 'Lead imported',
      detail: null,
      tone: 'system',
    });
  } else if (lead.sent) {
    items.push({
      id: 'sys-first-sent',
      ts: lead.sent,
      label: 'First sent',
      detail: null,
      tone: 'system',
    });
  }

  if (insights.agreementSent) {
    items.push({
      id: 'sys-agreement',
      ts: lead.sent,
      label: 'Agreement sent',
      detail: null,
      tone: 'system',
    });
  }

  if ((lead.sold || '').toLowerCase() === 'yes') {
    items.push({
      id: 'sys-sold',
      ts: lead.sent,
      label: 'Sold',
      detail: null,
      tone: 'sold',
    });
  }

  if ((lead.status || '').toLowerCase() === 'archived' || insights.archived) {
    items.push({
      id: 'sys-archived',
      ts: null,
      label: 'Archived',
      detail: null,
      tone: 'muted',
    });
  }

  if (lead.stop === 'yes' || insights.stopped) {
    items.push({
      id: 'sys-stopped',
      ts: null,
      label: 'Follow-ups stopped',
      detail: null,
      tone: 'warn',
    });
  }

  items.sort((a, b) => {
    const ta = parseTs(a.ts)?.getTime() ?? 0;
    const tb = parseTs(b.ts)?.getTime() ?? 0;
    return tb - ta;
  });

  const seen = new Set();
  return items.filter(item => {
    const key = `${item.label}|${item.ts}|${(item.detail || '').slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
