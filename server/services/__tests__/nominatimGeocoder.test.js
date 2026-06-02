import { describe, it, expect } from 'vitest';
import { formatSuggestion, formatLookupResult } from '../nominatimGeocoder.js';

describe('nominatimGeocoder formatting', () => {
  it('formats suggestion from Nominatim item', () => {
    const item = {
      display_name: '24, Morning Street, Portland, Maine, 04101, United States',
      lat: '43.666',
      lon: '-70.242',
      address: {
        house_number: '24',
        road: 'Morning Street',
        city: 'Portland',
        state: 'Maine',
        postcode: '04101',
      },
    };
    const s = formatSuggestion(item);
    expect(s.primary).toBe('24 Morning Street');
    expect(s.shortDisplay).toContain('Portland');
    expect(s.lat).toBeCloseTo(43.666);
  });

  it('formats lookup result', () => {
    const r = formatLookupResult({
      display_name: '24, Morning Street, Portland, Maine, 04101, United States',
      lat: '43.666',
      lon: '-70.242',
    });
    expect(r.display).toContain('Portland');
    expect(r.lng).toBeCloseTo(-70.242);
  });
});
