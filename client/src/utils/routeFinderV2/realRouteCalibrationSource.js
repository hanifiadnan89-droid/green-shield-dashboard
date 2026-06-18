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
export const CALIBRATION_ROUTE_DATE_ENV = 'ROUTE_DATE';

const ROUTE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {string|null|undefined} date
 * @returns {boolean}
 */
export function isValidCalibrationRouteDate(date) {
  return ROUTE_DATE_PATTERN.test(String(date ?? '').trim());
}

/**
 * @param {string[]|null|undefined} [argv]
 * @returns {string|null}
 */
export function parseCalibrationRouteDateFromArgv(argv = []) {
  const args = Array.isArray(argv) ? argv : [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i]);
    if (arg.startsWith('--routeDate=')) {
      return arg.slice('--routeDate='.length).trim() || null;
    }
    if (arg === '--routeDate' && args[i + 1]) {
      return String(args[i + 1]).trim() || null;
    }
  }

  return null;
}

/**
 * @param {{
 *   routeDate?: string|null,
 *   preferredDate?: string|null,
 *   routeDateFromArgv?: string|null,
 *   argv?: string[],
 * }} [options]
 * @returns {string|null}
 */
export function resolveRequestedCalibrationRouteDate(options = {}) {
  const fromArgv = options.routeDateFromArgv
    ?? parseCalibrationRouteDateFromArgv(options.argv);
  const fromEnv = typeof process !== 'undefined'
    ? String(process.env[CALIBRATION_ROUTE_DATE_ENV] ?? '').trim() || null
    : null;
  const fromOptions = String(options.routeDate ?? options.preferredDate ?? '').trim() || null;

  return fromOptions || fromArgv || fromEnv || null;
}

/**
 * @param {string} date
 * @returns {Promise<never>}
 */
async function throwMissingCalibrationRouteFile(date) {
  throw new Error(`data/routes/${date}.normalized.json not found`);
}

/**
 * Explicit route date: options.routeDate, --routeDate argv, or ROUTE_DATE env.
 * Otherwise prefer DEFAULT_CALIBRATION_ROUTE_DATE, then latest_available.
 *
 * @param {{
 *   routeDate?: string,
 *   preferredDate?: string,
 *   routeDateFromArgv?: string|null,
 *   argv?: string[],
 *   loadNormalizedRoutes?: (date: string) => Promise<NormalizedRoutePayload|null>,
 *   listCachedRouteDates?: () => Promise<string[]>,
 * }} [options]
 * @returns {Promise<(CachedRouteDateSummary & { selection: 'requested'|'preferred'|'latest_available' })|null>}
 */
export async function resolveCalibrationRouteDateForRun(options = {}) {
  const loadNormalizedRoutes = options.loadNormalizedRoutes ?? loadNormalizedRoutesFromDisk;
  const listRouteDates = options.listCachedRouteDates ?? listCachedRouteDates;
  const requestedDate = resolveRequestedCalibrationRouteDate(options);

  if (requestedDate) {
    if (!isValidCalibrationRouteDate(requestedDate)) {
      throw new Error(`Invalid ROUTE_DATE "${requestedDate}" — expected YYYY-MM-DD`);
    }

    const requestedPayload = await loadNormalizedRoutes(requestedDate);
    if (!requestedPayload?.technicians?.length) {
      await throwMissingCalibrationRouteFile(requestedDate);
    }

    return {
      date: requestedDate,
      ...summarizeNormalizedRoutePayload(requestedPayload),
      selection: 'requested',
    };
  }

  const preferredPayload = await loadNormalizedRoutes(DEFAULT_CALIBRATION_ROUTE_DATE);
  if (preferredPayload?.technicians?.length) {
    return {
      date: DEFAULT_CALIBRATION_ROUTE_DATE,
      ...summarizeNormalizedRoutePayload(preferredPayload),
      selection: 'preferred',
    };
  }

  const dates = await listRouteDates();
  const latestDate = pickCalibrationRouteDateFromList(dates, DEFAULT_CALIBRATION_ROUTE_DATE);
  if (!latestDate || latestDate === DEFAULT_CALIBRATION_ROUTE_DATE) return null;

  const latestPayload = await loadNormalizedRoutes(latestDate);
  if (!latestPayload?.technicians?.length) return null;

  return {
    date: latestDate,
    ...summarizeNormalizedRoutePayload(latestPayload),
    selection: 'latest_available',
  };
}

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
