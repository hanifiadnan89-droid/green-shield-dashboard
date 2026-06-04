import { sparklinePath } from '../Leads/leadsSparkline.js';
import {
  daysSince,
  isInFlightFollowup,
  isRepliedFollowup,
  isStoppedFollowup,
} from './followupsUtils.js';

const DAY_MS = 86_400_000;

function bucketBySentDay(leads, days, predicate) {
  const buckets = Array.from({ length: days }, () => 0);
  const now = Date.now();

  for (const lead of leads || []) {
    if (!predicate(lead)) continue;
    const sent = lead.sent;
    if (!sent || sent === 'imported') continue;
    const t = new Date(sent).getTime();
    if (Number.isNaN(t)) continue;
    const dayOffset = Math.floor((now - t) / DAY_MS);
    if (dayOffset < 0 || dayOffset >= days) continue;
    buckets[days - 1 - dayOffset] += 1;
  }

  return buckets;
}

export function buildFollowupKpiSparkline(allLeads, inFlightLeads, metric, days = 7) {
  switch (metric) {
    case 'active':
      return bucketBySentDay(inFlightLeads, days, () => true);
    case 'overdue':
      return bucketBySentDay(inFlightLeads, days, l => (daysSince(l.sent) ?? 0) >= 6);
    case 'stopped':
      return bucketBySentDay(allLeads, days, isStoppedFollowup);
    case 'replied':
      return bucketBySentDay(allLeads, days, isRepliedFollowup);
    case 'avgDays': {
      const buckets = Array.from({ length: days }, () => 0);
      const sums = Array.from({ length: days }, () => ({ total: 0, count: 0 }));
      const now = Date.now();

      for (const lead of inFlightLeads || []) {
        if (!isInFlightFollowup(lead)) continue;
        const sent = lead.sent;
        if (!sent || sent === 'imported') continue;
        const t = new Date(sent).getTime();
        if (Number.isNaN(t)) continue;
        const dayOffset = Math.floor((now - t) / DAY_MS);
        if (dayOffset < 0 || dayOffset >= days) continue;
        const d = daysSince(sent);
        if (d === null) continue;
        const idx = days - 1 - dayOffset;
        sums[idx].total += d;
        sums[idx].count += 1;
      }

      return sums.map(s => (s.count ? Math.round((s.total / s.count) * 10) / 10 : 0));
    }
    default:
      return Array.from({ length: days }, () => 0);
  }
}

/** Compare recent half vs prior half of sparkline buckets for a simple “this week” delta. */
export function sparklineWeekDelta(values) {
  const data = values?.length ? values : [0];
  if (data.length < 2) return 0;
  const mid = Math.ceil(data.length / 2);
  const recent = data.slice(mid).reduce((a, b) => a + b, 0);
  const prior = data.slice(0, mid).reduce((a, b) => a + b, 0);
  return recent - prior;
}

export function formatKpiTrend(metric, delta, avgDays) {
  if (metric === 'avgDays') {
    const val = Math.abs(delta) < 0.05 ? 0 : Math.round(Math.abs(delta) * 10) / 10;
    if (val === 0) return { text: 'steady this week', direction: 'neutral' };
    const sign = delta > 0 ? '+' : '-';
    return {
      text: `${sign}${val}d this week`,
      direction: delta <= 0 ? 'positive' : 'negative',
    };
  }

  if (delta === 0) return { text: 'no change this week', direction: 'neutral' };

  const sign = delta > 0 ? '+' : '';
  const abs = Math.abs(delta);
  const direction =
    metric === 'stopped' ? (delta < 0 ? 'positive' : 'negative')
      : metric === 'overdue' ? (delta > 0 ? 'negative' : 'positive')
        : (delta > 0 ? 'positive' : 'negative');

  return { text: `${sign}${abs} this week`, direction };
}

export function kpiSparkPath(values, accent = 'green') {
  return { d: sparklinePath(values), accent };
}
