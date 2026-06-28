/**
 * Convert a Places API (New) Place object into the legacy shape expected by
 * IntakeCustomerPage.parsePlace — keeps the intake flow unchanged.
 */
function readLatLng(point) {
  if (!point) return null;
  const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
  const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function toLegacyAutocompletePlace(place) {
  const components = (place?.addressComponents || []).map((component) => ({
    types: component.types || [],
    long_name: component.longText || component.long_name || '',
    short_name: component.shortText || component.short_name || '',
  }));

  const loc = place?.location;
  const latLng = readLatLng(loc);

  const types = Array.isArray(place?.types) && place.types.length
    ? place.types
    : place?.primaryType
      ? [place.primaryType]
      : [];

  const viewport = place?.viewport || null;

  return {
    address_components: components,
    formatted_address: place?.formattedAddress || '',
    geometry: latLng
      ? {
          location: {
            lat: () => latLng.lat,
            lng: () => latLng.lng,
          },
          viewport,
        }
      : undefined,
    place_id: place?.id || null,
    types,
  };
}
