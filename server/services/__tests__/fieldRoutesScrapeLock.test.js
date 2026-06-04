import { describe, it, expect, vi } from 'vitest';
import { withFieldRoutesScrapeLock, isFieldRoutesScrapeInFlight } from '../fieldRoutesScrapeLock.js';

describe('fieldRoutesScrapeLock', () => {
  it('runs tasks sequentially', async () => {
    const order = [];
    const a = withFieldRoutesScrapeLock('a', async () => {
      order.push('a-start');
      await new Promise(r => setTimeout(r, 20));
      order.push('a-end');
    });
    const b = withFieldRoutesScrapeLock('b', async () => {
      order.push('b-start');
      order.push('b-end');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('tracks in-flight state', async () => {
    expect(isFieldRoutesScrapeInFlight()).toBe(false);
    let resolveInner;
    const inner = new Promise(r => { resolveInner = r; });
    const task = withFieldRoutesScrapeLock('t', async () => {
      expect(isFieldRoutesScrapeInFlight()).toBe(true);
      await inner;
    });
    await new Promise(r => setTimeout(r, 5));
    expect(isFieldRoutesScrapeInFlight()).toBe(true);
    resolveInner();
    await task;
    expect(isFieldRoutesScrapeInFlight()).toBe(false);
  });
});
