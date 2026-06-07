import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLocalTechnicianPhotoCatalog } from './technicianPhotoLocal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../data');
const CACHE_FILE = path.join(CACHE_DIR, 'technician-photos-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bump when catalog source or mapping changes. */
export const CACHE_VERSION = 3;

export const TECHNICIAN_SECTION_MARKERS = {
  start: 'Lee G',
  end: 'Matt',
};

function readCache() {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
    if (!raw?.fetchedAt || !raw?.byName) return null;
    if (raw.cacheVersion !== CACHE_VERSION) return null;
    if (Date.now() - raw.fetchedAt > CACHE_TTL_MS) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(catalog) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const payload = {
    cacheVersion: CACHE_VERSION,
    fetchedAt: Date.now(),
    source: catalog.source,
    technicians: catalog.technicians,
    byName: catalog.byName,
    unmatched: catalog.unmatched || [],
  };
  writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

/**
 * Refresh from bundled local technician images (public/technicians).
 */
export async function refreshTechnicianPhotoCatalog({ force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }

  const catalog = buildLocalTechnicianPhotoCatalog();

  if (catalog.unmatched.length > 0) {
    console.warn(
      '[technician-photo-catalog] missing local files for:',
      catalog.unmatched.join(', '),
    );
  }

  console.log(
    `[technician-photo-catalog] loaded ${catalog.technicians.length} local technicians (v${CACHE_VERSION})`,
  );

  return writeCache(catalog);
}

export async function getTechnicianPhotoCatalog() {
  const cached = readCache();
  if (cached) return cached;
  return refreshTechnicianPhotoCatalog();
}

// Legacy exports kept for tests that import scrape helpers — re-export from scrape module if needed.
export { extractTeamNameOrder, extractTechnicianNames, buildTechnicianCatalog } from './technicianPhotoScrape.js';
