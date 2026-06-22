import { describe, it, expect } from 'vitest';
import { toLegacyAutocompletePlace } from '../placeAutocompleteLegacy.js';

describe('toLegacyAutocompletePlace', () => {
  it('maps new Place fields to legacy autocomplete shape', () => {
    const legacy = toLegacyAutocompletePlace({
      formattedAddress: '123 Main St, Saco, ME 04072, USA',
      id: 'ChIJtest',
      primaryType: 'street_address',
      location: { lat: 43.5, lng: -70.4 },
      addressComponents: [
        { types: ['street_number'], longText: '123', shortText: '123' },
        { types: ['route'], longText: 'Main Street', shortText: 'Main St' },
        { types: ['locality'], longText: 'Saco', shortText: 'Saco' },
        { types: ['administrative_area_level_1'], longText: 'Maine', shortText: 'ME' },
        { types: ['postal_code'], longText: '04072', shortText: '04072' },
      ],
    });

    expect(legacy.formatted_address).toBe('123 Main St, Saco, ME 04072, USA');
    expect(legacy.place_id).toBe('ChIJtest');
    expect(legacy.types).toEqual(['street_address']);
    expect(legacy.address_components).toHaveLength(5);
    expect(legacy.geometry.location.lat()).toBe(43.5);
    expect(legacy.geometry.location.lng()).toBe(-70.4);
  });
});
