/**
 * Decode a Google encoded polyline into lat/lng points.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * @param {string} encoded
 * @returns {Array<{ lat: number, lng: number }>}
 */
export function decodeEncodedPolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];

  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Decode one or more encoded polylines (segmented routes) into a single path.
 * @param {string | string[]} encoded
 */
export function decodeRoadPath(encoded) {
  if (!encoded) return [];
  if (Array.isArray(encoded)) {
    return encoded.flatMap(part => decodeEncodedPolyline(part));
  }
  return decodeEncodedPolyline(encoded);
}
