import {
  computePolygonAreaAcres,
  computePolygonAreaSqFt,
} from '../../../utils/intake/polygonArea.js';

/**
 * Shared area calculation used by PropertyMap (exported for tests).
 * @param {Array<{ lat: number, lng: number }>} path
 */
export function computeAreaMetrics(path) {
  if (!Array.isArray(path) || path.length < 3) {
    return { acres: 0, sqFt: 0 };
  }

  const spherical = typeof window !== 'undefined'
    ? window.google?.maps?.geometry?.spherical
    : undefined;

  if (spherical?.computeArea && window.google?.maps?.LatLng) {
    try {
      const latLngs = path.map((p) => new window.google.maps.LatLng(p.lat, p.lng));
      const sqMeters = Math.abs(spherical.computeArea(latLngs));
      const sqFt = sqMeters * 10.76391041671;
      return { acres: sqFt / 43560, sqFt };
    } catch {
      /* fall through */
    }
  }

  return {
    acres: computePolygonAreaAcres(path),
    sqFt: computePolygonAreaSqFt(path),
  };
}
