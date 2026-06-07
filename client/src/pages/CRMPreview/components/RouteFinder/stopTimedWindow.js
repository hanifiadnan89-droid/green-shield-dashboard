/** Max appointment window width (minutes) to show in stop sequence UI. */
export const STOP_TIMED_WINDOW_DISPLAY_MAX_MIN = 360;

function parseTimeToMinutes(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(':').map(Number);
  if (parts.length < 2 || parts.some(n => Number.isNaN(n))) return null;
  return parts[0] * 60 + parts[1];
}

function formatMinutes12h(totalMin) {
  if (totalMin == null) return null;
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const am = h24 < 12;
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

function formatMinutesShort(totalMin) {
  if (totalMin == null) return null;
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const am = h24 < 12;
  const h12 = h24 % 12 || 12;
  const minPart = m ? `:${String(m).padStart(2, '0')}` : '';
  return `${h12}${minPart}${am ? ' AM' : ' PM'}`;
}

function formatWindowRange(startMin, endMin) {
  const start = formatMinutesShort(startMin);
  const end = formatMinutesShort(endMin);
  if (!start || !end) return null;
  const startAm = startMin < 720;
  const endAm = endMin < 720;
  if (startAm === endAm) {
    const startNoMeridiem = start.replace(/ (AM|PM)$/, '');
    return `${startNoMeridiem}–${end}`;
  }
  return `${start}–${end}`;
}

/**
 * @param {object} stop
 * @returns {string | null} e.g. "Window: 9:00–11:00 AM"
 */
export function formatStopTimedWindowLabel(stop) {
  if (!stop || stop.isHomeStart || stop.isHomeEnd) return null;

  const startMin = stop.aptStartMinutes ?? parseTimeToMinutes(stop.startTime);
  const endMin = stop.aptEndMinutes ?? parseTimeToMinutes(stop.endTime);
  if (startMin == null || endMin == null) return null;

  const width = endMin - startMin;
  if (width <= 0 || width > STOP_TIMED_WINDOW_DISPLAY_MAX_MIN) return null;

  const range = formatWindowRange(startMin, endMin);
  return range ? `Window: ${range}` : null;
}

export function isNarrowTimedWindow(stop) {
  const startMin = stop?.aptStartMinutes ?? parseTimeToMinutes(stop?.startTime);
  const endMin = stop?.aptEndMinutes ?? parseTimeToMinutes(stop?.endTime);
  if (startMin == null || endMin == null) return false;
  const width = endMin - startMin;
  return width > 0 && width <= STOP_TIMED_WINDOW_DISPLAY_MAX_MIN;
}
