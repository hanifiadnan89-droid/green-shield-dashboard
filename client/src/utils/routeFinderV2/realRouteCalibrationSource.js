/**
 * Route Finder V2 — real/scraped FieldRoutes route loader for calibration.
 * Reads normalized cache files written by fieldRoutesPreloader or seedRouteCache.mjs.
 */

/**
 * @typedef {import('./validationExamples.js').RouteFinderValidationExample} RouteFinderValidationExample
 */

/**
 * @typedef {Object} NormalizedRoutePayload
 * @property {Array<{ techName?: string, routeId?: string|number, stops?: unknown[] }>} technicians
 * @property {string} [date]
 * @property {string} [source]
 */

/**
 * @typedef {(date: string) => Promise<NormalizedRoutePayload|null>} RouteLoaderForDate
 */

/**
 * @returns {Promise<string>}
 */
async function resolveRoutesCacheDir() {
  const { dirname, resolve } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return resolve(__dirname, '../../../..', 'data', 'routes');
}

/**
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<string>}
 */
export async function resolveNormalizedRouteCachePath(date) {
  const routesDir = await resolveRoutesCacheDir();
  const { resolve } = await import('node:path');
  return resolve(routesDir, `${date}.normalized.json`);
}

/**
 * @returns {Promise<string[]>}
 */
export async function listCachedRouteDates() {
  if (typeof process === 'undefined' || !process.versions?.node) return [];

  const { existsSync, readdirSync } = await import('node:fs');
  const routesDir = await resolveRoutesCacheDir();
  if (!existsSync(routesDir)) return [];

  return readdirSync(routesDir)
    .filter(name => name.endsWith('.normalized.json'))
    .map(name => name.replace('.normalized.json', ''))
    .sort();
}

/**
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<NormalizedRoutePayload|null>}
 */
export async function loadNormalizedRoutesFromDisk(date) {
  if (typeof process === 'undefined' || !process.versions?.node) return null;

  const { existsSync, readFileSync } = await import('node:fs');
  const cachePath = await resolveNormalizedRouteCachePath(date);
  if (!existsSync(cachePath)) return null;

  const raw = readFileSync(cachePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.technicians)) return null;

  return {
    ...parsed,
    date: parsed.date ?? date,
    technicians: parsed.technicians,
  };
}

/**
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<NormalizedRoutePayload|null>}
 */
export async function loadNormalizedRoutesForDate(date) {
  return loadNormalizedRoutesFromDisk(date);
}

/**
 * @param {RouteFinderValidationExample} example
 * @param {string|null|undefined} routeDate
 * @returns {string}
 */
export function resolveCalibrationRouteDate(example, routeDate) {
  if (routeDate) return routeDate;
  return example.date;
}

/**
 * @param {{
 *   routeDate?: string,
 *   loadRoutesForDate?: RouteLoaderForDate,
 * }} [options]
 * @returns {RouteLoaderForDate}
 */
export function createRouteLoader(options = {}) {
  if (typeof options.loadRoutesForDate === 'function') {
    return options.loadRoutesForDate;
  }

  return async (date) => loadNormalizedRoutesForDate(date);
}
