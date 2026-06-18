const SQFT_PER_ACRE = 43560;
const EARTH_RADIUS_M = 6378137;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Spherical excess area for a lat/lng polygon (m²), using Google Maps convention.
 * @param {Array<{lat: number, lng: number}>} path
 * @returns {number} area in square meters
 */
export function computePolygonAreaSqMeters(path) {
  if (!Array.isArray(path) || path.length < 3) return 0;

  let area = 0;
  const n = path.length;

  for (let i = 0; i < n; i += 1) {
    const p1 = path[i];
    const p2 = path[(i + 1) % n];
    area += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }

  return Math.abs(area * EARTH_RADIUS_M * EARTH_RADIUS_M / 2);
}

export function computePolygonAreaSqFt(path) {
  const sqM = computePolygonAreaSqMeters(path);
  return sqM * 10.76391041671;
}

export function computePolygonAreaAcres(path) {
  return computePolygonAreaSqFt(path) / SQFT_PER_ACRE;
}

export function formatAcreage(acres) {
  if (!Number.isFinite(acres) || acres <= 0) return '0';
  if (acres < 0.01) return acres.toFixed(4);
  if (acres < 1) return acres.toFixed(3);
  return acres.toFixed(2);
}

export function formatSquareFeet(sqFt) {
  if (!Number.isFinite(sqFt) || sqFt <= 0) return '0';
  return Math.round(sqFt).toLocaleString('en-US');
}
