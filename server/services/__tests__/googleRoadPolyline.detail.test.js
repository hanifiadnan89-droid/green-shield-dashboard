import { describe, it, expect } from 'vitest';
import { computeRoadPolyline } from '../googleRoadPolyline.js';

describe('googleRoadPolyline detail-only guard', () => {
  it('skips polyline when detailView is not set and config requires detail only', async () => {
    const result = await computeRoadPolyline({
      stops: [
        { lat: 43.2, lng: -70.5 },
        { lat: 43.3, lng: -70.4 },
      ],
      context: { routeId: 'r1', date: '2026-06-09' },
    });
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toBe('polyline_detail_only');
    expect(result.encodedPolyline).toBeNull();
  });
});
