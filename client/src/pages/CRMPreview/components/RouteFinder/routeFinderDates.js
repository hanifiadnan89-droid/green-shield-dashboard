export function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** Six upcoming weekdays (skips Sunday). */
export function buildDateMetas() {
  const metas = [];
  let offset = 0;
  while (metas.length < 6) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (d.getDay() !== 0) {
      const key = getLocalDateStr(offset);
      const label = offset === 0 ? 'Today'
        : offset === 1 ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      metas.push({ key, label });
    }
    offset++;
  }
  return metas;
}
