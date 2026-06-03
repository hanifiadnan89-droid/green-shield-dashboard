import {
  daysSince,
  hasRealReply,
  getPriorityLeads,
  TEMPLATE_META,
} from '../../mockData.js';

const _isReplied = (l) =>
  hasRealReply(l.sms_reply) || hasRealReply(l.email_reply) || l.status === 'replied';
const _isError = (l) =>
  !!(l.error && l.error.trim()) || l.status === 'error' || l.status === 'email_failed';
const _isStopped = (l) => l.stop === 'yes' || l.status === 'stopped';
const _hasSent = (l) => !!(l.sent && l.sent !== 'imported');

function countInRange(leads, start, end, pred = () => true) {
  return leads.filter((l) => {
    const ts = l.sent;
    if (!ts || ts === 'imported') return false;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return false;
    return d >= start && d < end && pred(l);
  }).length;
}

function buildDailySeries(leads, days, pred) {
  const points = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = countInRange(leads, start, end, pred);
    points.push({
      label: start.toLocaleDateString(undefined, { weekday: 'short' }),
      count,
      date: start,
    });
  }
  const max = Math.max(...points.map((p) => p.count), 1);
  return { points, max };
}

function trendPct(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function relativeTime(ts) {
  if (!ts) return 'Recently';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function derivePipelineDashboard(leads = [], stats = {}) {
  const total = stats.total ?? leads.length;
  const byTemplate = stats.byTemplate ?? {};
  const today = new Date().toDateString();

  const inProgress = stats.inProgress ?? 0;
  const replied = stats.replied ?? 0;
  const sold = stats.sold ?? 0;
  const sentToday = stats.sentToday ?? 0;

  const contacted = leads.filter(_hasSent).length;
  const pendingQuotes = leads.filter((l) => {
    const n = (l.notes || '').toLowerCase();
    return ['rit', 't/m', 'iq'].includes(n) && _hasSent(l) && !_isReplied(l) && !_isStopped(l);
  }).length;

  const repliesToday = leads.filter((l) => {
    if (!_isReplied(l)) return false;
    const ts = l.sent;
    if (!ts) return false;
    return new Date(ts).toDateString() === today;
  }).length;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStart = new Date(now);
  prevWeekStart.setDate(prevWeekStart.getDate() - 14);

  const kpis = [
    {
      id: 'total',
      label: 'Total Leads',
      value: total,
      href: '/leads',
      icon: 'users',
      trend: trendPct(
        countInRange(leads, weekStart, now),
        countInRange(leads, prevWeekStart, weekStart)
      ),
      spark: buildDailySeries(leads, 7, () => true).points.map((p) => p.count),
    },
    {
      id: 'inProgress',
      label: 'Active Follow-ups',
      value: inProgress,
      href: '/followups',
      icon: 'send',
      trend: trendPct(
        countInRange(leads, weekStart, now, (l) => _hasSent(l) && !_isReplied(l)),
        countInRange(leads, prevWeekStart, weekStart, (l) => _hasSent(l) && !_isReplied(l))
      ),
      spark: buildDailySeries(leads, 7, (l) => _hasSent(l) && !_isReplied(l) && !_isStopped(l)).points.map((p) => p.count),
    },
    {
      id: 'repliesToday',
      label: 'Replies Today',
      value: repliesToday,
      href: '/replies',
      icon: 'message',
      trend: trendPct(
        leads.filter((l) => _isReplied(l) && l.sent && new Date(l.sent) >= weekStart).length,
        leads.filter((l) => {
          if (!_isReplied(l) || !l.sent) return false;
          const d = new Date(l.sent);
          return d >= prevWeekStart && d < weekStart;
        }).length
      ),
      spark: buildDailySeries(leads, 7, _isReplied).points.map((p) => p.count),
    },
    {
      id: 'agreements',
      label: 'Agreements Sent',
      value: byTemplate.ag ?? 0,
      href: '/leads?category=sent',
      icon: 'file',
      trend: 0,
      spark: buildDailySeries(leads, 7, (l) => (l.notes || '').toLowerCase() === 'ag').points.map((p) => p.count),
    },
    {
      id: 'quotes',
      label: 'Pending Quotes',
      value: pendingQuotes,
      href: '/leads?category=inprogress',
      icon: 'dollar',
      trend: 0,
      spark: buildDailySeries(leads, 7, (l) => {
        const n = (l.notes || '').toLowerCase();
        return ['rit', 't/m', 'iq'].includes(n);
      }).points.map((p) => p.count),
    },
    {
      id: 'sold',
      label: 'Sold / Converted',
      value: sold,
      href: '/leads',
      icon: 'check',
      trend: trendPct(
        leads.filter((l) => l.sold === 'yes').length,
        leads.filter((l) => l.sold === 'yes').length
      ),
      spark: buildDailySeries(leads, 7, (l) => l.sold === 'yes').points.map((p) => p.count),
    },
  ];

  const services = [
    {
      id: 'rit',
      label: 'Rodent & Insect Triennial',
      shortLabel: 'RIT',
      count: byTemplate.rit ?? 0,
      color: TEMPLATE_META.rit?.color ?? '#2563EB',
    },
    {
      id: 'tm',
      label: 'Tick & Mosquito',
      shortLabel: 'T/M',
      count: byTemplate.tm ?? 0,
      color: TEMPLATE_META['t/m']?.color ?? '#ec4899',
    },
    {
      id: 'iq',
      label: 'Insect Quarterly',
      shortLabel: 'IQ',
      count: byTemplate.iq ?? 0,
      color: TEMPLATE_META.iq?.color ?? '#9333EA',
    },
  ];

  const pipelineFlow = [
    { key: 'new', label: 'New Leads', count: total, color: '#22d3ee' },
    { key: 'contacted', label: 'Contacted', count: contacted, color: '#4ade80' },
    { key: 'followup', label: 'In Follow-up', count: inProgress, color: '#a3e635' },
    { key: 'quotes', label: 'Quotes', count: pendingQuotes, color: '#c084fc' },
    { key: 'converted', label: 'Converted', count: sold, color: '#fb923c' },
  ];

  const conversionRate = total > 0 ? Math.round((sold / total) * 100) : 0;
  const soldPrev = leads.filter((l) => {
    if (l.sold !== 'yes' || !l.sent) return false;
    const d = new Date(l.sent);
    return d >= prevWeekStart && d < weekStart;
  }).length;
  const soldCurr = leads.filter((l) => {
    if (l.sold !== 'yes' || !l.sent) return false;
    return new Date(l.sent) >= weekStart;
  }).length;
  const conversionTrend = trendPct(soldCurr, soldPrev) || (conversionRate === 0 ? -100 : 0);

  const leadActivity = buildLeadActivitySeries(leads, 7);

  const followupsDueList = leads
    .filter((l) => !_isStopped(l) && !_isReplied(l) && _hasSent(l))
    .map((l) => ({ ...l, overdueDays: daysSince(l.sent) }))
    .filter((l) => l.overdueDays !== null && l.overdueDays >= 3)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 5);

  const followupsDueCount = leads.filter((l) => {
    const d = daysSince(l.sent);
    return !_isStopped(l) && !_isReplied(l) && _hasSent(l) && d !== null && d >= 6;
  }).length;

  const templateKeys = ['ag', 'na', 'rit', 't/m', 'iq'];
  const templatePerformance = templateKeys
    .map((key) => {
      const count = key === 't/m' ? (byTemplate.tm ?? 0) : (byTemplate[key] ?? 0);
      const meta = TEMPLATE_META[key] || { label: key.toUpperCase(), fullLabel: key, color: '#4ade80' };
      return {
        key,
        label: `${meta.label} — ${meta.fullLabel}`,
        count,
        color: meta.color,
      };
    })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);

  const maxTemplate = Math.max(...templatePerformance.map((t) => t.count), 1);

  const repliesSeries = buildDailySeries(leads, 7, _isReplied);
  const repliesTotal = replied;
  const repliesPrevWeek = leads.filter((l) => {
    if (!_isReplied(l) || !l.sent) return false;
    const d = new Date(l.sent);
    return d >= prevWeekStart && d < weekStart;
  }).length;
  const repliesCurrWeek = leads.filter((l) => {
    if (!_isReplied(l) || !l.sent) return false;
    return new Date(l.sent) >= weekStart;
  }).length;
  const repliesTrend = trendPct(repliesCurrWeek, repliesPrevWeek);

  const overdueCount = followupsDueCount;
  const errorsCount = stats.errors ?? 0;
  const healthChecks = [
    {
      id: 'followups',
      label: 'Follow-ups on track',
      ok: overdueCount < Math.max(3, inProgress * 0.2),
    },
    {
      id: 'errors',
      label: errorsCount === 0 ? 'No send errors' : `${errorsCount} errors need review`,
      ok: errorsCount === 0,
    },
    {
      id: 'replies',
      label: replied > 0 ? 'Replies flowing' : 'Awaiting first reply',
      ok: replied > 0,
    },
    {
      id: 'n8n',
      label: 'n8n automation active',
      ok: true,
    },
  ];
  const healthScore = Math.round(
    (healthChecks.filter((c) => c.ok).length / healthChecks.length) * 100
  );

  const priority = getPriorityLeads(leads);
  const todayActivity = buildTodayActivity(leads, priority);

  return {
    kpis,
    services,
    pipelineFlow,
    conversionRate,
    conversionTrend,
    leadActivity,
    followupsDueList,
    followupsDueCount,
    templatePerformance,
    maxTemplate,
    repliesSeries,
    repliesTotal,
    repliesTrend,
    healthChecks,
    healthScore,
    todayActivity,
    sentToday,
    statusTotal: total,
    metrics: { total, replied, inProgress, errors: errorsCount, sold },
  };
}

function buildLeadActivitySeries(leads, days) {
  const points = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const newLeads = countInRange(leads, start, end, () => true);
    const replies = countInRange(leads, start, end, _isReplied);
    const sent = countInRange(leads, start, end, _hasSent);
    const followups = leads.filter((l) => {
      if (!_hasSent(l) || _isReplied(l) || _isStopped(l)) return false;
      const d = new Date(l.sent);
      return d < end;
    }).length;

    points.push({
      label: start.toLocaleDateString(undefined, { weekday: 'short' }),
      newLeads,
      replies,
      sent,
      followups,
      total: newLeads + replies + sent,
    });
  }
  const max = Math.max(...points.map((p) => p.total), 1);
  const legend = {
    newLeads: points.reduce((s, p) => s + p.newLeads, 0),
    replies: points.reduce((s, p) => s + p.replies, 0),
    sentTemplates: points.reduce((s, p) => s + p.sent, 0),
    followups: leads.filter((l) => _hasSent(l) && !_isReplied(l) && !_isStopped(l)).length,
  };
  return { points, max, legend };
}

function buildTodayActivity(leads, priority) {
  const items = [];

  for (const lead of priority.replied.slice(0, 2)) {
    items.push({
      id: `r-${lead.row_number}`,
      type: 'reply',
      text: `${lead.name} replied`,
      time: relativeTime(lead.sent),
      ts: lead.sent,
    });
  }

  const recentSent = [...leads]
    .filter(_hasSent)
    .sort((a, b) => new Date(b.sent) - new Date(a.sent))
    .slice(0, 2);
  for (const lead of recentSent) {
    const tpl = (lead.notes || '').toUpperCase() || 'Template';
    items.push({
      id: `s-${lead.row_number}`,
      type: 'sent',
      text: `${tpl} sent to ${lead.name}`,
      time: relativeTime(lead.sent),
      ts: lead.sent,
    });
  }

  for (const lead of priority.inSequence.slice(0, 1)) {
    items.push({
      id: `f-${lead.row_number}`,
      type: 'overdue',
      text: `${lead.name} — follow-up overdue`,
      time: relativeTime(lead.sent),
      ts: lead.sent,
    });
  }

  for (const lead of leads.filter((l) => !_hasSent(l)).slice(0, 1)) {
    items.push({
      id: `n-${lead.row_number}`,
      type: 'new',
      text: `New lead · ${lead.name}`,
      time: 'Today',
      ts: null,
    });
  }

  for (const lead of priority.errors.slice(0, 1)) {
    items.push({
      id: `e-${lead.row_number}`,
      type: 'error',
      text: `Send issue · ${lead.name}`,
      time: relativeTime(lead.sent),
      ts: lead.sent,
    });
  }

  return items
    .sort((a, b) => {
      const ta = a.ts ? new Date(a.ts).getTime() : Date.now();
      const tb = b.ts ? new Date(b.ts).getTime() : Date.now();
      return tb - ta;
    })
    .slice(0, 8);
}
