import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(__dirname, '../data');
const CACHE_FILE = path.join(CACHE_DIR, 'technician-photos-cache.json');
const ABOUT_URL = 'https://gshieldpest.com/about/';
const WP_MEDIA_SEARCH = 'https://gshieldpest.com/wp-json/wp/v2/media?per_page=100&search=headshot';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Bump when catalog shape or mapping logic changes (invalidates stale caches). */
export const CACHE_VERSION = 2;

/** Authoritative technician display names from gshieldpest.com/about (Technicians section). */
export const TECHNICIAN_SECTION_MARKERS = {
  start: 'Lee G',
  end: 'Matt',
};

const UA = 'GreenShield-CRM/1.0 (+https://gshieldpest.com)';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchAboutHtml() {
  const res = await fetch(ABOUT_URL, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Encoding': 'gzip' },
  });
  if (!res.ok) throw new Error(`About page HTTP ${res.status}`);
  return res.text();
}

/** All team member h3 headings on the About page (owners through office). */
export function extractTeamNameOrder(html) {
  const names = [];
  const re = /<h3[^>]*>([^<]+)<\/h3>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    if (!name || name === 'Meet the Team') continue;
    names.push(name);
  }
  return names;
}

/**
 * Slice technician names from the About page team list (Technicians section only).
 * Preserves display names like "Lee G" and "Chris M" as distinct records.
 */
export function extractTechnicianNames(allNames) {
  const startIdx = allNames.indexOf(TECHNICIAN_SECTION_MARKERS.start);
  const endIdx = allNames.indexOf(TECHNICIAN_SECTION_MARKERS.end, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `Technician section not found on About page (expected ${TECHNICIAN_SECTION_MARKERS.start}–${TECHNICIAN_SECTION_MARKERS.end})`,
    );
  }
  return allNames.slice(startIdx, endIdx + 1);
}

async function fetchHeadshotMedia() {
  const all = [];
  let page = 1;
  for (;;) {
    const batch = await fetchJson(`${WP_MEDIA_SEARCH}&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return all
    .map(item => {
      const url = item.source_url?.split('?')[0] || '';
      const numMatch = url.match(/headshots25-(\d+)\.jpg$/i);
      return { num: numMatch ? parseInt(numMatch[1], 10) : 999, url };
    })
    .filter(item => item.url)
    .sort((a, b) => a.num - b.num);
}

/**
 * Map technician display names to headshot URLs using each name's global index on the
 * About page (same order as the website team grid — not first-name fuzzy matching).
 */
export function buildTechnicianCatalog(allNames, photos) {
  const technicianNames = extractTechnicianNames(allNames);
  const byName = {};
  const unmatched = [];

  for (const name of technicianNames) {
    const globalIdx = allNames.indexOf(name);
    const photo = globalIdx >= 0 ? photos[globalIdx] : null;
    if (photo?.url) {
      byName[name] = photo.url;
    } else {
      byName[name] = null;
      unmatched.push(name);
    }
  }

  return { byName, technicians: technicianNames, unmatched };
}

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

function writeCache({ byName, technicians, unmatched }) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const payload = {
    cacheVersion: CACHE_VERSION,
    fetchedAt: Date.now(),
    source: ABOUT_URL,
    technicians,
    byName,
    unmatched: unmatched || [],
  };
  writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export async function refreshTechnicianPhotoCatalog({ force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }

  const [html, photos] = await Promise.all([fetchAboutHtml(), fetchHeadshotMedia()]);
  const allNames = extractTeamNameOrder(html);
  const catalog = buildTechnicianCatalog(allNames, photos);

  if (catalog.unmatched.length > 0) {
    console.warn(
      '[technician-photo-catalog] unmatched technicians:',
      catalog.unmatched.join(', '),
    );
  }

  console.log(
    `[technician-photo-catalog] refreshed ${catalog.technicians.length} technicians (v${CACHE_VERSION})`,
  );

  return writeCache(catalog);
}

export async function getTechnicianPhotoCatalog() {
  const cached = readCache();
  if (cached) return cached;
  return refreshTechnicianPhotoCatalog();
}
