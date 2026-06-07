import { describe, it, expect } from 'vitest';
import { decodeEncodedPolyline, decodeRoadPath } from './decodePolyline.js';

describe('decodePolyline', () => {
  it('decodes a known Google encoded polyline', () => {
    const points = decodeEncodedPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points.length).toBeGreaterThan(1);
    expect(points[0].lat).toBeCloseTo(38.5, 1);
    expect(points[0].lng).toBeCloseTo(-120.2, 1);
  });

  it('decodes segmented polylines', () => {
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const path = decodeRoadPath([encoded, encoded]);
    expect(path.length).toBeGreaterThan(2);
  });
});
