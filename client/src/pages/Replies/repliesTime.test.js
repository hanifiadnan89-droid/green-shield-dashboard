import { describe, it, expect } from 'vitest';
import {
  formatDateSeparatorMaine,
  formatListTimeMaine,
  REPLIES_TIME_ZONE,
} from './repliesTime.js';
import { filterDisplayThread, isTemplateMessage } from './threadUtils.js';

describe('repliesTime', () => {
  it('uses America/New_York timezone', () => {
    expect(REPLIES_TIME_ZONE).toBe('America/New_York');
  });

  it('formats list time for valid ISO timestamps', () => {
    const label = formatListTimeMaine('2026-06-04T18:30:00.000Z');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns empty string for invalid timestamps', () => {
    expect(formatListTimeMaine('imported')).toBe('');
    expect(formatListTimeMaine(null)).toBe('');
  });
});

describe('filterDisplayThread', () => {
  it('hides template events but keeps real messages', () => {
    const thread = [
      { id: 't', direction: 'outbound', body: 'Check-in sent', meta: { isTemplate: true }, ts: '2026-01-01' },
      { id: 'a', direction: 'inbound', body: 'Hi', ts: '2026-01-02' },
    ];
    expect(isTemplateMessage(thread[0])).toBe(true);
    expect(filterDisplayThread(thread)).toHaveLength(1);
    expect(filterDisplayThread(thread)[0].body).toBe('Hi');
  });
});
