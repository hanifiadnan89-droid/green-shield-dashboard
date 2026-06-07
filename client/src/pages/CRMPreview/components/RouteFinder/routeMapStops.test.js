import { describe, it, expect } from 'vitest';
import { getMapStops, getStopMarkerMeta } from './routeMapStops.js';

describe('routeMapStops home markers', () => {
  it('includes home start and end markers with distinct roles', () => {
    const stops = [
      { lat: 43.64, lng: -70.27, isHomeStart: true, customerName: 'Home Start' },
      { lat: 43.65, lng: -70.26, customerName: 'Appt 1' },
      { lat: 43.66, lng: -70.25, isNew: true, customerName: 'New' },
      { lat: 43.65, lng: -70.28, isHomeEnd: true, customerName: 'Home End' },
    ];

    const mapStops = getMapStops(stops);
    expect(mapStops).toHaveLength(4);

    const meta = getStopMarkerMeta(stops);
    expect(meta.find(m => m.role === 'home_start')?.label).toBe('S');
    expect(meta.find(m => m.role === 'home_end')?.label).toBe('E');
    expect(meta.find(m => m.role === 'new')?.label).toBe('N');
  });
});
