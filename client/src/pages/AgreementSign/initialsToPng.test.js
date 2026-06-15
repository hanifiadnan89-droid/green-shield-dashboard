import { describe, it, expect } from 'vitest';
import { normalizeInitialsInput } from './initialsToPng.js';

describe('normalizeInitialsInput', () => {
  it('uppercases letters and trims to six characters', () => {
    expect(normalizeInitialsInput(' jd ')).toBe('JD');
    expect(normalizeInitialsInput('abc123def')).toBe('ABCDEF');
  });

  it('allows periods and hyphens in initials', () => {
    expect(normalizeInitialsInput('j.d.')).toBe('J.D.');
  });
});
