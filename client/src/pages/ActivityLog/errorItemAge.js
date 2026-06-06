/** Visual-only age tier from dateAdded — does not affect filtering or API logic. */

export function parseSheetDate(value) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return null;

  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) return direct;

  const match = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (match) {
    const month = Number(match[1]) - 1;
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(year, month, day).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function getItemAgeTier(dateAdded) {
  const ts = parseSheetDate(dateAdded);
  if (!ts) return 'fresh';

  const hours = (Date.now() - ts) / (1000 * 60 * 60);
  if (hours >= 48) return 'stale';
  if (hours >= 24) return 'aging';
  return 'fresh';
}
