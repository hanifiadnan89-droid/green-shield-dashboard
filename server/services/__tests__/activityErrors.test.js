import { describe, expect, it } from 'vitest';
import {
  isOpenDashboardStatus,
  isWithinActivityLogRowLimit,
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

  it('derives contract value from Column G notes', () => {
    const rows = padRows([
      ['Date Added', 'Added By', 'Sales Rep', 'Customer ID', 'Customer Name', 'Cus Card Tab Error', 'Notes'],
      ['', '', 'AH', '27194', 'SRA Varieties', 'UNPAID IS/OTS', '5/22 $449 IS'],
    ]);

    const { items } = parseErrorListRows(rows, { assignee: 'AH', headerRowNumber: 11 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      customerId: '27194',
      reason: 'UNPAID IS/OTS',
      notes: '5/22 $449 IS',
      detectedErrorType: 'Unpaid Initial Service',
      paymentType: 'IS',
      originalPriceLabel: '$449 IS',
      contractValue: 1164,
      contractValueLabel: '$1,164',
    });
  });

  it('only includes sheet rows 1 through 60', () => {
    expect(isWithinActivityLogRowLimit(60)).toBe(true);
    expect(isWithinActivityLogRowLimit(61)).toBe(false);

    const rows = Array.from({ length: 65 }, (_, idx) => {
      if (idx === 10) {
        return ['Date Added', 'Added By', 'Sales Rep', 'Customer ID', 'Customer Name', 'Reason'];
      }
      return ['', '', 'AH', `ID-${idx + 1}`, `Name ${idx + 1}`, 'UNPAID IS/OTS'];
    });

    const { items } = parseErrorListRows(rows, { assignee: 'AH', headerRowNumber: 11 });
    expect(items.every(item => item.rowNumber <= 60)).toBe(true);
    expect(items.some(item => item.rowNumber === 60)).toBe(true);
    expect(items.some(item => item.rowNumber === 61)).toBe(false);
  });

  it('hides locally completed row numbers', () => {
    const rows = padRows([
      ['Date Added', 'Added By', 'Sales Rep', 'Customer ID', 'Customer Name', 'Cus Card Tab Error'],
      ['', '', 'AH', '27191', 'Acme', 'UNPAID IS/OTS'],
      ['', '', 'AH', '27194', 'Beta', 'UNPAID IS/OTS'],
    ]);

    const { items } = parseErrorListRows(rows, {
      assignee: 'AH',
      headerRowNumber: 11,
      completedRowSet: new Set([12]),
    });
    expect(items).toHaveLength(1);
    expect(items[0].rowNumber).toBe(13);
  });
});
