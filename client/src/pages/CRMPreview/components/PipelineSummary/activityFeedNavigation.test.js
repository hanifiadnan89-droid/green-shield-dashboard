import { describe, it, expect } from 'vitest';
import { getActivityFeedDestination, templateNotesKey } from './activityFeedNavigation.js';

describe('activityFeedNavigation', () => {
  it('routes replies to Replies with row selection', () => {
    const dest = getActivityFeedDestination({
      type: 'reply',
      rowNumber: 42,
    });
    expect(dest.pathname).toBe('/replies');
    expect(dest.search).toBe('?row=42');
    expect(dest.state?.selectRowNumber).toBe(42);
  });

  it('routes agreement sent to Leads with ag filter', () => {
    const dest = getActivityFeedDestination({
      type: 'sent',
      rowNumber: 7,
      notes: 'ag',
    });
    expect(dest.pathname).toBe('/leads');
    expect(dest.search).toContain('notes=ag');
    expect(dest.search).toContain('row=7');
  });

  it('routes overdue to Follow-ups', () => {
    const dest = getActivityFeedDestination({
      type: 'overdue',
      rowNumber: 3,
    });
    expect(dest.pathname).toBe('/followups');
    expect(dest.search).toContain('filter=overdue');
    expect(dest.state?.quickFilter).toBe('overdue');
  });

  it('normalizes t/m template key', () => {
    expect(templateNotesKey('t/m')).toBe('tm');
  });
});
