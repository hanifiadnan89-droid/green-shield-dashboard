/** Daily send counts for the last N days (newest bucket last). */
export function buildLeadSparkline(leads, days = 7) {
  const buckets = Array.from({ length: days }, () => 0);
  const now = Date.now();

  for (const lead of leads || []) {
    const sent = lead.sent;
    if (!sent || sent === 'imported') continue;
    const t = new Date(sent).getTime();
    if (Number.isNaN(t)) continue;
    const dayOffset = Math.floor((now - t) / 86_400_000);
    if (dayOffset < 0 || dayOffset >= days) continue;
    buckets[days - 1 - dayOffset] += 1;
  }

  return buckets;
}

export function sparklinePath(values, width = 88, height = 28) {
  const data = values?.length ? values : [0];
  const max = Math.max(...data, 1);
  const step = width / Math.max(data.length - 1, 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return `M ${points.join(' L ')}`;
}
