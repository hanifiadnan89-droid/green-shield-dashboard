import { describe, it, expect } from 'vitest';
import { formatStopTimedWindowLabel, isNarrowTimedWindow } from './stopTimedWindow.js';

describe('formatStopTimedWindowLabel', () => {
  it('shows narrow timed windows', () => {
    expect(formatStopTimedWindowLabel({
      startTime: '09:00:00',
      endTime: '11:00:00',
    })).toBe('Window: 9–11 AM');
  });

  it('hides broad all-day windows', () => {
    expect(formatStopTimedWindowLabel({
      aptStartMinutes: 480,
      aptEndMinutes: 1080,
    })).toBeNull();
  });

  it('ignores home markers', () => {
    expect(formatStopTimedWindowLabel({ isHomeStart: true, startTime: '09:00', endTime: '11:00' })).toBeNull();
  });
});

describe('isNarrowTimedWindow', () => {
  it('detects narrow windows from minutes', () => {
    expect(isNarrowTimedWindow({ aptStartMinutes: 540, aptEndMinutes: 660 })).toBe(true);
    expect(isNarrowTimedWindow({ aptStartMinutes: 480, aptEndMinutes: 1080 })).toBe(false);
  });
});
