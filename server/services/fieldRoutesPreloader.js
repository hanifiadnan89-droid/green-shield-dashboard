import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractRoutePayload } from '../../client/src/utils/fieldRoutesExtractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(__dirname, '../../data/routes');
const META_PATH = resolve(ROUTES_DIR, 'cache-meta.json');

// ---------------------------------------------------------------------------
// STUB — awaiting DevTools request details from user
// ---------------------------------------------------------------------------

async function fetchRawPayload(date) {
  // eslint-disable-next-line no-unused-vars
  throw new Error(
    `fetchRawPayload not implemented — provide DevTools request details ` +
    `(method, URL, headers, body) to enable live FieldRoutes fetch for ${date}`
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function getNextThreeDates() {
  return [0, 1, 2].map(getLocalDateStr);
}

async function readMeta() {
  try {
    const raw = await fs.readFile(META_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeMeta(meta) {
  await fs.mkdir(ROUTES_DIR, { recursive: true });
  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2));
}

async function updateMeta(date, fields) {
  const meta = await readMeta();
  meta[date] = { ...(meta[date] || {}), ...fields };
  await writeMeta(meta);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function refreshDate(date) {
  await updateMeta(date, { status: 'refreshing', timestamp: new Date().toISOString() });
  try {
    const raw = await fetchRawPayload(date);
    await fs.mkdir(ROUTES_DIR, { recursive: true });
    await fs.writeFile(
      resolve(ROUTES_DIR, `${date}.raw.json`),
      JSON.stringify(raw, null, 2)
    );
    const { result, stats } = extractRoutePayload(raw);
    await fs.writeFile(
      resolve(ROUTES_DIR, `${date}.normalized.json`),
      JSON.stringify(result, null, 2)
    );
    await updateMeta(date, {
      status: 'cached',
      timestamp: new Date().toISOString(),
      techCount: result.technicians.length,
      stopCount: stats.stopsExtracted,
    });
    return result;
  } catch (err) {
    const status = err.message.includes('not implemented') ? 'not_configured' : 'failed';
    await updateMeta(date, {
      status,
      timestamp: new Date().toISOString(),
      error: err.message,
    });
    throw err;
  }
}

export async function getStatus() {
  const dates = getNextThreeDates();
  const meta = await readMeta();
  const result = {};
  for (const date of dates) {
    result[date] = meta[date] || { status: 'missing' };
  }
  return result;
}

export async function getNormalizedForDate(date) {
  const normPath = resolve(ROUTES_DIR, `${date}.normalized.json`);
  try {
    const raw = await fs.readFile(normPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function preloadNextThreeDays() {
  const dates = getNextThreeDates();
  const meta = await readMeta();
  for (const date of dates) {
    const entry = meta[date];
    if (entry?.status === 'cached' && entry?.timestamp) {
      const ageMs = Date.now() - new Date(entry.timestamp).getTime();
      if (ageMs < 6 * 60 * 60 * 1000) continue;
    }
    try {
      await refreshDate(date);
    } catch {
      // Continue to next date even if one fails
    }
  }
}
