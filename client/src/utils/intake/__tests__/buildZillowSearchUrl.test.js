import { describe, expect, it } from 'vitest';
import { buildZillowSearchUrl } from '../buildZillowSearchUrl.js';

describe('buildZillowSearchUrl', () => {
  it('builds a Zillow search URL from intake address components', () => {
    expect(buildZillowSearchUrl({
      serviceAddress: '34B Cloudman Street',
      city: 'Westbrook',
      state: 'ME',
      zip: '04092',
    })).toBe('https://www.zillow.com/homes/34B-Cloudman-Street,-Westbrook,-ME-04092_rb/');
  });

  it('normalizes ZIP+4 and parses verified address fallback', () => {
    expect(buildZillowSearchUrl({
      verifiedAddress: '34B Cloudman Street, Westbrook, ME 04092-3404, USA',
    })).toBe('https://www.zillow.com/homes/34B-Cloudman-Street,-Westbrook,-ME-04092_rb/');
  });

  it('returns null when no address is available', () => {
    expect(buildZillowSearchUrl({})).toBeNull();
  });
});
