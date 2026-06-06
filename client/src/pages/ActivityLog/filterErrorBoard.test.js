import { describe, expect, it } from 'vitest';
import { filterErrorBoardItems } from './filterErrorBoard.js';

describe('filterErrorBoardItems', () => {
  const items = [
    { id: '1', category: 'unpaid' },
    { id: '2', category: 'pending' },
    { id: '3', category: 'line_busy' },
    { id: '4', category: 'other' },
  ];

  it('returns all items for All filter', () => {
    expect(filterErrorBoardItems(items, 'all')).toHaveLength(4);
    expect(filterErrorBoardItems(items)).toHaveLength(4);
  });

  it('filters unpaid, pending, and other groups', () => {
    expect(filterErrorBoardItems(items, 'unpaid')).toEqual([items[0]]);
    expect(filterErrorBoardItems(items, 'pending')).toEqual([items[1]]);
    expect(filterErrorBoardItems(items, 'other')).toEqual([items[2], items[3]]);
  });
});
