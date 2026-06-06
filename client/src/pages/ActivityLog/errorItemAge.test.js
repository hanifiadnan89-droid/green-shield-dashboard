import { describe, expect, it } from 'vitest';
import { getItemAgeTier, parseSheetDate } from './errorItemAge.js';

describe('errorItemAge', () => {
  it('parses sheet dates', () => {
    expect(parseSheetDate('5/22/2024')).not.toBeNull();
  });

  it('returns stale for old dates', () => {
    const old = new Date();
    old.setDate(old.getDate() - 4);
    expect(getItemAgeTier(old.toLocaleDateString('en-US'))).toBe('stale');
  });
});
