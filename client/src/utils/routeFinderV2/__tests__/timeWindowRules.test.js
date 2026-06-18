import { describe, it, expect } from 'vitest';
import {
  TIME_WINDOW_RULES,
  getTimeWindowRule,
  parseRouteFinderWindow,
  isHardWindow,
  isSoftWindow,
} from '../timeWindowRules.js';

describe('timeWindowRules', () => {
  it('defines broad and slot windows', () => {
    expect(TIME_WINDOW_RULES.ANYTIME.label).toBe('8:00 AM–6:00 PM');
    expect(TIME_WINDOW_RULES.AM.label).toBe('8:00 AM–12:00 PM');
    expect(TIME_WINDOW_RULES.PM.label).toBe('12:00 PM–6:00 PM');
    expect(TIME_WINDOW_RULES['8-10'].label).toBe('8:00 AM–10:00 AM');
    expect(TIME_WINDOW_RULES['12-4'].label).toBe('12:00 PM–4:00 PM');
  });

  it('getTimeWindowRule resolves AM/PM/ANYTIME', () => {
    expect(getTimeWindowRule('AM').key).toBe('AM');
    expect(getTimeWindowRule('pm').key).toBe('PM');
    expect(getTimeWindowRule('AT').key).toBe('AT');
    expect(getTimeWindowRule('unknown').key).toBe('ANYTIME');
  });

  it('parseRouteFinderWindow handles specific slots', () => {
    expect(parseRouteFinderWindow('specific', '8-10').key).toBe('8-10');
    expect(parseRouteFinderWindow('specific', '2-4').startMinutes).toBe(14 * 60);
    expect(parseRouteFinderWindow('AM').key).toBe('AM');
    expect(parseRouteFinderWindow('specific', null).key).toBe('ANYTIME');
  });

  it('classifies hard vs soft windows', () => {
    expect(isHardWindow('8-10')).toBe(true);
    expect(isHardWindow('4-6')).toBe(true);
    expect(isSoftWindow('AM')).toBe(true);
    expect(isSoftWindow('8-12')).toBe(true);
    expect(isHardWindow('AM')).toBe(false);
    expect(isSoftWindow('10-12')).toBe(false);
  });
});
