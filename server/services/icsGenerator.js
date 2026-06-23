/**
 * Generates .ics (iCalendar) content for a Green Shield treatment appointment.
 * No external dependencies. RFC 5545 compliant.
 * Compatible with: Apple Calendar, Google Calendar, Outlook, Android.
 */

const APPOINTMENT_DESCRIPTION =
  'Your Green Shield Pest Solutions initial treatment is scheduled. ' +
  'Please make sure your service agreement is signed before the technician arrives. ' +
  'Someone should be available during the appointment window. ' +
  'Questions? Call 207-815-2234 or 207-815-2284.';

/** Fold lines longer than 75 octets per RFC 5545 §3.1 */
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join('\r\n');
}

function escapeValue(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Parse a single time token like "8:00 AM", "8am", "11", "14:30".
 * Returns minutes from midnight, or null.
 *
 * Heuristic for no explicit AM/PM:
 *   hour < 8  → assume PM (e.g. "2" → 2pm)
 *   hour >= 8 → assume AM (e.g. "8" → 8am, "11" → 11am)
 */
function parseTimeToMinutes(raw) {
  const s = (raw || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;

  const match = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;

  let h = parseInt(match[1], 10);
  const m = parseInt(match[2] || '0', 10);
  const period = match[3] || null;

  if (period === 'pm' && h !== 12) h += 12;
  else if (period === 'am' && h === 12) h = 0;
  else if (!period) {
    if (h < 8) h += 12;
  }

  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Parse an appointment window like "8:00 AM – 11:00 AM", "8am-11am",
 * "8-11", "2-5pm", "10:00 AM - 1:00 PM".
 * Returns { startMin, endMin } in minutes from midnight, or null.
 */
export function parseAppointmentWindow(window) {
  if (!window) return null;
  const normalized = String(window).trim().replace(/[–—]/g, '-');

  const parts = normalized
    .split(/\s*-\s*|\s+to\s+/i)
    .map(s => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  if (parts.length === 1) {
    const start = parseTimeToMinutes(parts[0]);
    if (start === null) return null;
    return { startMin: start, endMin: Math.min(start + 180, 23 * 60) };
  }

  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null || end <= start) return null;
  return { startMin: start, endMin: end };
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}${m}00`;
}

function isoToIcsDate(dateStr) {
  return (dateStr || '').replace(/-/g, '');
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

const VTIMEZONE_EASTERN = [
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYDAY=2SU;BYMONTH=3',
  'TZOFFSETFROM:-0500',
  'TZOFFSETTO:-0400',
  'TZNAME:EDT',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYDAY=1SU;BYMONTH=11',
  'TZOFFSETFROM:-0400',
  'TZOFFSETTO:-0500',
  'TZNAME:EST',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/**
 * Generate .ics calendar invite for a treatment appointment.
 *
 * @param {object} opts
 * @param {string} opts.appointmentDate   YYYY-MM-DD
 * @param {string} [opts.appointmentWindow]  e.g. "8:00 AM – 11:00 AM"
 * @param {string} [opts.location]        Service address string
 * @param {string|number} [opts.uid]      Unique ID (lead row_number)
 * @returns {{ content: string, filename: string, isAllDay: boolean }}
 */
export function generateIcs({ appointmentDate, appointmentWindow, location, uid = 'treatment' }) {
  if (!appointmentDate) throw new Error('appointmentDate is required');

  const dateFormatted = isoToIcsDate(appointmentDate);
  const times = parseAppointmentWindow(appointmentWindow);
  const isAllDay = !times;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Shield Pest Solutions//Treatment Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  if (!isAllDay) {
    lines.push(...VTIMEZONE_EASTERN);
  }

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:gshield-${uid}-${appointmentDate}@gshieldpest.com`);
  lines.push(`DTSTAMP:${nowStamp()}`);

  if (isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateFormatted}`);
    lines.push(`DTEND;VALUE=DATE:${dateFormatted}`);
  } else {
    lines.push(`DTSTART;TZID=America/New_York:${dateFormatted}T${minutesToTime(times.startMin)}`);
    lines.push(`DTEND;TZID=America/New_York:${dateFormatted}T${minutesToTime(times.endMin)}`);
  }

  lines.push('SUMMARY:Green Shield Initial Treatment');

  if (location) {
    lines.push(foldLine(`LOCATION:${escapeValue(location)}`));
  }

  lines.push(foldLine(`DESCRIPTION:${escapeValue(APPOINTMENT_DESCRIPTION)}`));

  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT24H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Green Shield Treatment Tomorrow',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Green Shield Treatment in 2 Hours',
    'END:VALARM',
  );

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  return {
    content,
    filename: `green-shield-treatment-${appointmentDate}.ics`,
    isAllDay,
  };
}

/**
 * Build a nodemailer attachment object from a generateIcs result.
 */
export function buildIcsAttachment({ content, filename }) {
  return {
    filename,
    content: Buffer.from(content, 'utf8'),
    contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
  };
}
