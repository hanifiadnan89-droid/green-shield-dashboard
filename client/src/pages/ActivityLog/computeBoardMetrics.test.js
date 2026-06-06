import { describe, expect, it } from 'vitest';
import { computeUnpaidInitialMetrics } from './computeBoardMetrics.js';

describe('computeUnpaidInitialMetrics', () => {
  it('sums contract values for unpaid initial items only', () => {
    const metrics = computeUnpaidInitialMetrics([
      { category: 'unpaid', contractValue: 1164 },
      { category: 'unpaid', contractValue: 1048 },
      { category: 'pending', contractValue: 399 },
      { category: 'unpaid', contractValue: null },
    ]);

    expect(metrics.totalValue).toBe(2212);
    expect(metrics.totalLabel).toBe('$2,212 USD');
    expect(metrics.unpaidCount).toBe(3);
    expect(metrics.subtext).toBe('Across 3 active unpaid initial items');
  });
});
