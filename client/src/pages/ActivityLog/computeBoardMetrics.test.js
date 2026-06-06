import { describe, expect, it } from 'vitest';
import { computeLostContractMetrics, formatLostValue } from './computeBoardMetrics.js';

describe('computeLostContractMetrics', () => {
  it('sums contract values for active board items', () => {
    const metrics = computeLostContractMetrics([
      { contractValue: 1164, isComplete: false },
      { contractValue: 1048, isComplete: false },
      { contractValue: 399, isComplete: false },
      { contractValue: null, isComplete: false },
    ]);

    expect(metrics.totalLost).toBe(2611);
    expect(metrics.lostLabel).toBe('-$2,611 USD');
    expect(metrics.activeCount).toBe(4);
    expect(metrics.allResolved).toBe(false);
  });

  it('formats zero lost value without a negative sign', () => {
    expect(formatLostValue(0)).toBe('$0 USD');
    expect(computeLostContractMetrics([])).toMatchObject({
      totalLost: 0,
      lostLabel: '$0 USD',
      allResolved: true,
      subtext: 'No revenue at risk',
    });
  });
});
