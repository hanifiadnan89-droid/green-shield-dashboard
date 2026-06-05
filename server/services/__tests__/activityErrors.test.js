import { describe, expect, it } from 'vitest';
import {
  isOpenDashboardStatus,
  parseErrorListRows,
  resolveStatusColumn,
} from '../activityErrors.js';

describe('activityErrors', () => {
  it('resolves dashboard_status column from header', () => {
    const result = resolveStatusColumn(['Date', 'Type', 'Initials', 'Customer ID', 'Name', 'Reason', 'dashboard_status']);
    expect(result.statusColumn).toBe('G');
    expect(result.statusColIdx).toBe(6);
  });

  it('filters AH rows and hides complete items', () => {
    const rows = [
      ['Date', 'Type', 'Initials', 'Customer ID', 'Name', 'Reason', 'dashboard_status'],
      ['', '', 'AH', 'C-100', 'Acme', 'Billing issue', ''],
      ['', '', 'AH', 'C-200', 'Beta', 'Missing note', 'open'],
      ['', '', 'AH', 'C-300', 'Done', 'Resolved', 'complete'],
      ['', '', 'XX', 'C-400', 'Other', 'Ignore', ''],
      ['', '', 'AH', 'C-500', 'Gamma', 'Follow up', 'not complete'],
    ];

    const { items } = parseErrorListRows(rows, { assignee: 'AH' });
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ rowNumber: 2, customerId: 'C-100', reason: 'Billing issue' });
    expect(items[1]).toMatchObject({ rowNumber: 3, customerId: 'C-200', reason: 'Missing note' });
    expect(items[2]).toMatchObject({ rowNumber: 6, customerId: 'C-500', reason: 'Follow up' });
  });

  it('treats not complete as open', () => {
    expect(isOpenDashboardStatus('not complete')).toBe(true);
    expect(isOpenDashboardStatus('complete')).toBe(false);
    expect(isOpenDashboardStatus('')).toBe(true);
  });
});
