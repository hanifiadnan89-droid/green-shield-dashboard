import { describe, it, expect } from 'vitest';
import {
  buildRentCastAddressVariants,
  expandStreetAbbreviations,
  stripTrailingHouseLetter,
  stripUnitFromStreet,
  formatRentCastAddress,
} from '../rentCastAddressVariants.js';

describe('rentCastAddressVariants', () => {
  it('builds component-based address with 5-digit zip', () => {
    const variants = buildRentCastAddressVariants({
      street: '34B Cloudman Street',
      city: 'Westbrook',
      state: 'ME',
      zip: '04092-3404',
    });

    expect(variants).toContain('34B Cloudman Street, Westbrook, ME, 04092');
    expect(variants).toContain('34 Cloudman Street, Westbrook, ME, 04092');
    expect(variants).toContain('34B Cloudman St, Westbrook, ME, 04092');
  });

  it('includes normalized Google verified address', () => {
    const variants = buildRentCastAddressVariants({
      street: '34B Cloudman St',
      city: 'Westbrook',
      state: 'ME',
      zip: '04092',
      verifiedAddress: '34B Cloudman Street, Westbrook, ME 04092-3404, USA',
    });

    expect(variants).toContain('34B Cloudman Street, Westbrook, ME 04092');
  });

  it('strips units and trailing house letters', () => {
    expect(stripUnitFromStreet('123 Main St Apt 4B')).toBe('123 Main St');
    expect(stripTrailingHouseLetter('34B Cloudman Street')).toBe('34 Cloudman Street');
    expect(expandStreetAbbreviations('34B Cloudman St')).toBe('34B Cloudman Street');
  });

  it('formats RentCast address strings', () => {
    expect(formatRentCastAddress('5500 Grand Lake Dr', 'San Antonio', 'TX', '78244'))
      .toBe('5500 Grand Lake Dr, San Antonio, TX, 78244');
  });
});
