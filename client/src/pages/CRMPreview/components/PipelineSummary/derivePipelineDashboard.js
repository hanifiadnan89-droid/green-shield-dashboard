import { daysSince, hasRealReply, getPriorityLeads, TEMPLATE_META } from '../../mockData.js';

const _isReplied = (l) =>
  hasRealReply(l.sms_reply) || hasRealReply(l.email_reply) || l.status === 'replied';
const _isError = (l) =>
  !!(l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed';
const _isStopped = (l) => l.stop === 'yes' || l.status === 'stopped';
const _hasSent = (l) => !!(l.sent && l.sent !== 'imported');

export function derivePipelineDashboard(leads = [], stats = {}) {
  const total = stats.total ?? leads.length;
  const byTemplate = stats.byTemplate ?? {};
  const today = new Date().toDateString();

  const repliesToday = leads.filter((l) => {
    if (!_isReplied(l)) return false;
    const ts = l.sent || l.updated_at;
    if (!ts) return false;
    return new Date(ts).toDateString() === today;
  }).length;

  const pendingQuotes = leads.filter((l) => {
    const n = (l.notes || '').toLowerCase();
    return ['rit', 't/m', 'iq'].includes(n) && _hasSent(l) && !_isReplied(l) && !_isStopped(l);
  }).length;

  const kpis = [
    { id: 'total', label: 'Total Leads', value: total, href: '/leads' },
    { id: 'inProgress', label: 'Active Follow-ups', value: stats.inProgress ?? 0, href: '/followups' },
    { id: 'repliesToday', label: 'Replies Today', value: repliesToday, href: '/replies' },
    { id: 'agreements', label: 'Agreements Sent', value: byTemplate.ag ?? 0, href: '/leads?category=sent' },
    { id: 'quotes', label: 'Pending Quotes', value: pendingQuotes, href: '/leads?category=inprogress' },
    { id: 'sold', label: 'Sold / Converted', value: stats.sold ?? 0, href: '/leads' },
    { id: 'noAnswer', label: 'Missed / No Answer', value: byTemplate.na ?? 0, href: '/leads?category=inprogress' },
    { id: 'tm', label: 'Tick & Mosquito', value: byTemplate.tm ?? 0 },
    { id: 'rit', label: 'Rodent / Insect', value: byTemplate.rit ?? 0 },
  ];

  const inProgress = stats.inProgress ?? 0;
  const replied = stats.replied ?? 0;
  const stopped = stats.stopped ?? 0;
  const errors = stats.errors ?? 0;
  const notContacted = Math.max(0, total - inProgress - replied - stopped - errors);

  const statusSegments = [
    { key: 'replied', label: 'Replied', count: replied, color: '#4ade80' },
    { key: 'in_flight', label: 'In Flight', count: inProgress, color: '#22d3ee' },
    { key: 'stopped', label: 'Stopped', count: stopped, color: '#94a3b8' },
    { key: 'errors', label: 'Errors', count: errors, color: '#f87171' },
    { key: 'other', label: 'Other', count: notContacted, color: '#475569' },
  ].filter(s => s.count > 0);

  const templateKeys = ['ag', 'na', 'rit', 't/m', 'iq'];
  const templateBars = templateKeys.map((key) => {
    const count = key === 't/m' ? (byTemplate.tm ?? 0) : (byTemplate[key] ?? 0);
    const meta = TEMPLATE_META[key] || { label: key.toUpperCase(), color: '#4ade80' };
    return { key, label: meta.label, count, color: meta.color };
  }).filter(t => t.count > 0);

  const maxTemplate = Math.max(...templateBars.map(t => t.count), 1);

  const conversionRate = total > 0 ? Math.round(((stats.sold ?? 0) / total) * 100) : 0;
  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;

  const sparkline = buildSparkline(leads, 7);

  const priority = getPriorityLeads(leads);

  const activityItems = buildActivityFeed(leads, priority);

  const recentLeads = [...leads]
    .filter(_hasSent)
    .sort((a, b) => new Date(b.sent) - new Date(a.sent))
    .slice(0, 6);

  const hotLeads = [
    ...priority.replied.slice(0, 3),
    ...priority.agreements.slice(0, 2),
    ...priority.errors.slice(0, 2),
  ].slice(0, 6);

  return {
    kpis,
    statusSegments,
    statusTotal: total,
    templateBars,
    maxTemplate,
    conversionRate,
    replyRate,
    sparkline,
    activityItems,
    recentLeads,
    hotLeads,
    sentToday: stats.sentToday ?? 0,
    metrics: {
      total,
      replied,
      inProgress,
      errors,
      sold: stats.sold ?? 0,
    },
  };
}

function buildSparkline(leads, days) {
  const points = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const count = leads.filter((l) => {
      if (!l.sent || l.sent === 'imported') return false;
      return new Date(l.sent).toDateString() === key;
    }).length;
    points.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), count });
  }
  const max = Math.max(...points.map(p => p.count), 1);
  return { points, max };
}

function buildActivityFeed(leads, priority) {
  const items = [];

  for (const lead of priority.replied.slice(0, 3)) {
    items.push({
      id: `reply-${lead.row_number}`,
      type: 'reply',
      title: `${lead.name} replied`,
      sub: lead._reason || 'Customer response',
      tone: 'success',
    });
  }

  const sentRecent = leads
    .filter(l => _hasSent(l) && (daysSince(l.sent) ?? 99) <= 1)
    .slice(0, 3);
  for (const lead of sentRecent) {
    const tpl = (lead.notes || '').toUpperCase() || 'Template';
    items.push({
      id: `sent-${lead.row_number}`,
      type: 'sent',
      title: `Sent ${tpl} to ${lead.name}`,
      sub: 'Sequence started · n8n active',
      tone: 'info',
    });
  }

  for (const lead of priority.inSequence.slice(0, 2)) {
    items.push({
      id: `followup-${lead.row_number}`,
      type: 'followup',
      title: `Follow-up due · ${lead.name}`,
      sub: lead._reason,
      tone: 'warn',
    });
  }

  for (const lead of priority.errors.slice(0, 2)) {
    items.push({
      id: `error-${lead.row_number}`,
      type: 'error',
      title: `Needs attention · ${lead.name}`,
      sub: lead._reason,
      tone: 'danger',
    });
  }

  return items.slice(0, 8);
}
