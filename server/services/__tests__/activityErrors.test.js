import { describe, expect, it } from 'vitest';
import {
  isOpenDashboardStatus,
  parseErrorListRows,
  resolveStatusColumn,
} from '../activityErrors.js';

function padRows(rows) {
  const out = [];
  for (let i = 0; i < 10; i++) out.push([]);
  return out.concat(rows);
}

describe('activityErrors', () => {
  it('resolves dashboard_status column from header', () => {
    const result = resolveStatusColumn(['Date', 'Type', 'Initials', 'Customer ID', 'Name', 'Reason', 'dashboard_status']);
    expect(result.statusColumn).toBe('G');
    expect(result.statusColIdx).toBe(6);
  });

  it('filters AH rows from header row 11 and hides complete items', () => {
    const rows = padRows([
      ['Date Added', 'Added By', 'Sales Rep', 'Customer ID', 'Customer Name', 'Cus Card Tab Error', 'Notes', '', '', '', '', 'dashboard_status'],
      ['', '', 'AH', '27191', 'Acme', 'UNPAID IS/OTS', 'note', '', '', '', '', ''],
      ['', '', 'AH', '27194', 'Beta', 'UNPAID IS/OTS', '', '', '', '', '', 'open'],
      ['', '', 'AH', '16592', 'Done', 'UNPAID IS/OTS', '', '', '', '', '', 'complete'],
      ['', '', 'KO', '99999', 'Other', 'Ignore', '', '', '', '', '', ''],
      ['', '', 'AH', '27257', 'Gamma', 'Subscription', '', '', '', '', '', 'not complete'],
    ]);

    const { items } = parseErrorListRows(rows, { assignee: 'AH', headerRowNumber: 11 });
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ rowNumber: 12, customerId: '27191', reason: 'UNPAID IS/OTS' });
    expect(items[1]).toMatchObject({ rowNumber: 13, customerId: '27194', reason: 'UNPAID IS/OTS' });
    expect(items[2]).toMatchObject({ rowNumber: 16, customerId: '27257', reason: 'Subscription' });
  });

  it('treats not complete as open', () => {
    expect(isOpenDashboardStatus('not complete')).toBe(true);
    expect(isOpenDashboardStatus('complete')).toBe(false);
    expect(isOpenDashboardStatus('')).toBe(true);
  });
});
