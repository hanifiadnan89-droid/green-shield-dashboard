import { describe, it, expect } from 'vitest';
import { resolveTimeWindowPref } from './resolveTimeWindowPref.js';

describe('resolveTimeWindowPref', () => {
  it('returns AM or PM directly', () => {
    expect(resolveTimeWindowPref('AM', null)).toBe('AM');
    expect(resolveTimeWindowPref('PM', null)).toBe('PM');
  });

  it('requires a slot when specific', () => {
    expect(resolveTimeWindowPref('specific', null)).toBe(null);
    expect(resolveTimeWindowPref('specific', '8-12')).toBe('8-12');
  });

  it('returns null when no preference', () => {
    expect(resolveTimeWindowPref(null, null)).toBe(null);
  });
});
