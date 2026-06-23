import { describe, it, expect } from 'vitest';
import { generateIcs, parseAppointmentWindow, buildIcsAttachment } from '../icsGenerator.js';

describe('parseAppointmentWindow', () => {
  it('parses "8:00 AM – 11:00 AM"', () => {
    const r = parseAppointmentWindow('8:00 AM – 11:00 AM');
    expect(r).toEqual({ startMin: 480, endMin: 660 });
  });

  it('parses "8am-11am"', () => {
    const r = parseAppointmentWindow('8am-11am');
    expect(r).toEqual({ startMin: 480, endMin: 660 });
  });

  it('parses "8-11" (no period, morning heuristic)', () => {
    const r = parseAppointmentWindow('8-11');
    expect(r).toEqual({ startMin: 480, endMin: 660 });
  });

  it('parses "2-5pm"', () => {
    const r = parseAppointmentWindow('2-5pm');
    expect(r).toEqual({ startMin: 14 * 60, endMin: 17 * 60 });
  });

  it('parses "10:00 AM - 1:00 PM"', () => {
    const r = parseAppointmentWindow('10:00 AM - 1:00 PM');
    expect(r).toEqual({ startMin: 600, endMin: 780 });
  });

  it('parses "8 to 11am"', () => {
    const r = parseAppointmentWindow('8 to 11am');
    expect(r).toEqual({ startMin: 480, endMin: 660 });
  });

  it('returns null for empty string', () => {
    expect(parseAppointmentWindow('')).toBeNull();
    expect(parseAppointmentWindow(null)).toBeNull();
  });

  it('returns null for end <= start', () => {
    expect(parseAppointmentWindow('11am-8am')).toBeNull();
  });

  it('single time → 3-hour window', () => {
    const r = parseAppointmentWindow('9am');
    expect(r).toEqual({ startMin: 9 * 60, endMin: 9 * 60 + 180 });
  });
});

describe('generateIcs', () => {
  it('throws if appointmentDate is missing', () => {
    expect(() => generateIcs({ appointmentWindow: '8am-11am' })).toThrow('appointmentDate is required');
  });

  it('produces valid .ics envelope', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', appointmentWindow: '8:00 AM - 11:00 AM', location: '123 Main St, Portland, ME 04101', uid: 42 });
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('END:VCALENDAR');
    expect(content).toContain('BEGIN:VEVENT');
    expect(content).toContain('END:VEVENT');
  });

  it('sets correct DTSTART/DTEND with timezone for timed window', () => {
    const { content, isAllDay } = generateIcs({ appointmentDate: '2026-07-15', appointmentWindow: '8:00 AM - 11:00 AM', uid: 1 });
    expect(isAllDay).toBe(false);
    expect(content).toContain('DTSTART;TZID=America/New_York:20260715T080000');
    expect(content).toContain('DTEND;TZID=America/New_York:20260715T110000');
    expect(content).toContain('BEGIN:VTIMEZONE');
    expect(content).toContain('TZID:America/New_York');
  });

  it('falls back to all-day event when window cannot be parsed', () => {
    const { content, isAllDay } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(isAllDay).toBe(true);
    expect(content).toContain('DTSTART;VALUE=DATE:20260715');
    expect(content).toContain('DTEND;VALUE=DATE:20260715');
    expect(content).not.toContain('BEGIN:VTIMEZONE');
  });

  it('includes correct title', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(content).toContain('SUMMARY:Green Shield Initial Treatment');
  });

  it('includes location when provided', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', location: '456 Oak Rd, Bangor, ME 04401', uid: 1 });
    expect(content).toContain('LOCATION:456 Oak Rd');
  });

  it('omits LOCATION line when no location provided', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(content).not.toContain('LOCATION:');
  });

  it('includes the required description text', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(content).toContain('207-815-2234');
    expect(content).toContain('service agreement is signed');
  });

  it('includes 24-hour and 2-hour VALARM blocks', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(content).toContain('TRIGGER:-PT24H');
    expect(content).toContain('TRIGGER:-PT2H');
    const alarmCount = (content.match(/BEGIN:VALARM/g) || []).length;
    expect(alarmCount).toBe(2);
  });

  it('includes UID scoped to appointment date and lead uid', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', uid: 99 });
    expect(content).toContain('UID:gshield-99-2026-07-15@gshieldpest.com');
  });

  it('produces correct filename', () => {
    const { filename } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(filename).toBe('green-shield-treatment-2026-07-15.ics');
  });

  it('uses CRLF line endings', () => {
    const { content } = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    expect(content).toContain('\r\n');
    expect(content.split('\r\n').length).toBeGreaterThan(5);
  });
});

describe('buildIcsAttachment', () => {
  it('returns nodemailer-compatible attachment object', () => {
    const ics = generateIcs({ appointmentDate: '2026-07-15', uid: 1 });
    const attachment = buildIcsAttachment(ics);
    expect(attachment.filename).toBe('green-shield-treatment-2026-07-15.ics');
    expect(attachment.contentType).toContain('text/calendar');
    expect(Buffer.isBuffer(attachment.content)).toBe(true);
  });
});
