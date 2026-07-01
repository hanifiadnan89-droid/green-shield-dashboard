import { countInRange, templateKey } from './dashboardUtils.js';

export function buildDailySeries(items, days, pred, getTimestamp = (item) => item?.raw?.sent ?? item?.sent ?? null) {
  const points = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    points.push({
      label: start.toLocaleDateString(undefined, { weekday: 'short' }),
      count: countInRange(items, start, end, pred, getTimestamp),
      date: start,
    });
  }

  return {
    points,
    max: Math.max(...points.map((point) => point.count), 1),
  };
}

export function buildTemplatePerformance(byTemplate) {
  const templateKeys = ['ag', 'na', 'rit', 'tm', 'iq'];
  const templateMeta = {
    ag: { label: 'AG', fullLabel: 'Agreement Sent', color: '#16A34A' },
    na: { label: 'NA', fullLabel: 'No Answer', color: '#D97706' },
    rit: { label: 'RIT', fullLabel: 'Rodent & Insect', color: '#2563EB' },
    tm: { label: 'T/M', fullLabel: 'Tick & Mosquito', color: '#ec4899' },
    iq: { label: 'IQ', fullLabel: 'Insect Quarterly', color: '#9333EA' },
  };

  return templateKeys
    .map((key) => ({
      key,
      label: `${templateMeta[key].label} — ${templateMeta[key].fullLabel}`,
      count: byTemplate[key] ?? 0,
      color: templateMeta[key].color,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
}
