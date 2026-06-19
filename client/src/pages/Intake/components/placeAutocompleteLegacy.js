/**
 * Convert a Places API (New) Place object into the legacy shape expected by
 * IntakeCustomerPage.parsePlace — keeps the intake flow unchanged.
 */
export function toLegacyAutocompletePlace(place) {
  const components = (place?.addressComponents || []).map((component) => ({
    types: component.types || [],
    long_name: component.longText || component.long_name || '',
    short_name: component.shortText || component.short_name || '',
  }));

  const loc = place?.location;
  const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
  const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;

  const types = Array.isArray(place?.types) && place.types.length
    ? place.types
    : place?.primaryType
      ? [place.primaryType]
      : [];

  return {
    address_components: components,
    formatted_address: place?.formattedAddress || '',
    geometry: Number.isFinite(lat) && Number.isFinite(lng)
      ? {
          location: {
            lat: () => lat,
            lng: () => lng,
          },
        }
      : undefined,
    place_id: place?.id || null,
    types,
  };
}
