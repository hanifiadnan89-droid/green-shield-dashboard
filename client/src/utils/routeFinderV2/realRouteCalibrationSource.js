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
 * @typedef {Object} CachedRouteDateSummary
 * @property {string} date
 * @property {number} technicianCount
 * @property {number} stopCount
 * @property {string|null} source
 */

/**
 * @param {NormalizedRoutePayload|null|undefined} payload
 * @returns {{ technicianCount: number, stopCount: number, source: string|null }}
 */
export function summarizeNormalizedRoutePayload(payload) {
  const technicians = payload?.technicians ?? [];
  const stopCount = technicians.reduce((sum, tech) => sum + (tech?.stops?.length ?? 0), 0);
  return {
    technicianCount: technicians.length,
    stopCount,
    source: payload?.source ?? null,
  };
}

export const DEFAULT_CALIBRATION_ROUTE_DATE = '2026-06-18';

/**
 * @param {string[]} dates - YYYY-MM-DD strings
 * @param {string} [preferredDate]
 * @returns {string|null}
 */
export function pickCalibrationRouteDateFromList(
  dates,
  preferredDate = DEFAULT_CALIBRATION_ROUTE_DATE,
) {
  const sorted = [...dates].sort();
  if (sorted.includes(preferredDate)) return preferredDate;
  if (!sorted.length) return null;
  return sorted[sorted.length - 1];
}

/**
 * Prefer DEFAULT_CALIBRATION_ROUTE_DATE when cached; otherwise use the latest
 * available *.normalized.json date under data/routes/.
 *
 * @param {{ preferredDate?: string }} [options]
 * @returns {Promise<(CachedRouteDateSummary & { selection: 'preferred'|'latest_available' })|null>}
 */
export async function resolveCalibrationRouteDateForRun(options = {}) {
  const preferredDate = options.preferredDate ?? DEFAULT_CALIBRATION_ROUTE_DATE;
  const preferredPayload = await loadNormalizedRoutesFromDisk(preferredDate);

  if (preferredPayload?.technicians?.length) {
    return {
      date: preferredDate,
      ...summarizeNormalizedRoutePayload(preferredPayload),
      selection: 'preferred',
    };
  }

  const dates = await listCachedRouteDates();
  const latestDate = pickCalibrationRouteDateFromList(dates, preferredDate);
  if (!latestDate || latestDate === preferredDate) return null;

  const latestPayload = await loadNormalizedRoutesFromDisk(latestDate);
  if (!latestPayload?.technicians?.length) return null;

  return {
    date: latestDate,
    ...summarizeNormalizedRoutePayload(latestPayload),
    selection: 'latest_available',
  };
}

/**
 * @param {string[]|null|undefined} [preferredDates]
 * @returns {Promise<CachedRouteDateSummary|null>}
 */
export async function findMostCompleteCachedRouteDate(preferredDates = null) {
  if (!preferredDates?.length) {
    const resolved = await resolveCalibrationRouteDateForRun();
    if (!resolved) return null;
    const { selection, ...summary } = resolved;
    return summary;
  }

  let best = null;

  for (const date of preferredDates) {
    const payload = await loadNormalizedRoutesFromDisk(date);
    if (!payload?.technicians?.length) continue;

    const summary = summarizeNormalizedRoutePayload(payload);
    const candidate = { date, ...summary };

    if (
      !best
      || candidate.stopCount > best.stopCount
      || (candidate.stopCount === best.stopCount && candidate.technicianCount > best.technicianCount)
    ) {
      best = candidate;
    }
  }

  if (best) return best;

  return resolveCalibrationRouteDateForRun().then(result => {
    if (!result) return null;
    const { selection, ...summary } = result;
    return summary;
  });
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
