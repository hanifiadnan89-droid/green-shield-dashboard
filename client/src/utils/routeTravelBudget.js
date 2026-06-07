/** Client-side matrix element estimation (mirrors server/routesApiBudget.js). */

function pointKey(point) {
  if (!point?.lat || !point?.lng) return null;
  return `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
}

export function estimateMatrixElements(legs = []) {
  const origins = new Set();
  const destinations = new Set();
  for (const leg of legs) {
    const o = pointKey(leg.origin);
    const d = pointKey(leg.destination);
    if (o) origins.add(o);
    if (d) destinations.add(d);
  }
  return origins.size * destinations.size;
}

export function countUniqueLegs(legs = []) {
  const seen = new Set();
  let count = 0;
  for (const leg of legs) {
    const o = pointKey(leg.origin);
    const d = pointKey(leg.destination);
    if (!o || !d) continue;
    const key = `${o}->${d}`;
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }
  return count;
}

/** Mirrors server batch vs pairwise billing (see server/services/routesApiBudget.js). */
export function estimateBilledElements(legs = [], options = {}) {
  const maxElementsPerRoute = options.maxElementsPerRoute ?? 50;
  const matrixElements = estimateMatrixElements(legs);
  const uniqueLegs = countUniqueLegs(legs);

  if (matrixElements > maxElementsPerRoute) {
    return uniqueLegs;
  }
  return matrixElements;
}
