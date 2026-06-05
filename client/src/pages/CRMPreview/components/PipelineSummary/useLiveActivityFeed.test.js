import { describe, it, expect } from 'vitest';
import { rotateFeedOrder } from './useLiveActivityFeed.js';

describe('rotateFeedOrder', () => {
  it('moves the first item to the end', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(rotateFeedOrder(items).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('returns the same list when length is 0 or 1', () => {
    expect(rotateFeedOrder([])).toEqual([]);
    expect(rotateFeedOrder([{ id: 'only' }])).toEqual([{ id: 'only' }]);
  });
});
