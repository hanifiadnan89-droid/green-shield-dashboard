/**
 * Development utility: seed the route cache from the existing sample JSON.
 * Use this to test the Route Finder UI without needing live FieldRoutes access.
 *
 * Usage:
 *   node scripts/seedRouteCache.mjs [YYYY-MM-DD]
 *   node scripts/seedRouteCache.mjs              # uses today's date
 *   node scripts/seedRouteCache.mjs 2026-05-18   # specific date
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractRoutePayload } from '../client/src/utils/fieldRoutesExtractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = resolve(__dirname, '../data/fieldroutes-sample.json');
const ROUTES_DIR  = resolve(__dirname, '../data/routes');
const META_PATH   = resolve(ROUTES_DIR, 'cache-meta.json');

if (!existsSync(SAMPLE_PATH)) {
  console.error('✗ data/fieldroutes-sample.json not found. Cannot seed cache.');
  process.exit(1);
}

// Target date: CLI arg or today
const rawDate = process.argv[2];
let targetDate;
if (rawDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    console.error('✗ Date must be in YYYY-MM-DD format');
    process.exit(1);
  }
  targetDate = rawDate;
} else {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  targetDate = `${y}-${mo}-${day}`;
}

console.log(`\n[seedRouteCache] Seeding cache for date: ${targetDate}`);

// Load sample
const raw = JSON.parse(readFileSync(SAMPLE_PATH, 'utf8'));

// Extract
const { result, stats } = extractRoutePayload(raw);
console.log(`[seedRouteCache] Extracted: ${result.technicians.length} technicians, ${stats.stopsExtracted} stops (${stats.duplicatesRemoved} dupes removed)`);

// Write cache files
mkdirSync(ROUTES_DIR, { recursive: true });
writeFileSync(resolve(ROUTES_DIR, `${targetDate}.raw.json`), JSON.stringify(raw, null, 2));
writeFileSync(resolve(ROUTES_DIR, `${targetDate}.normalized.json`), JSON.stringify(result, null, 2));
console.log(`[seedRouteCache] ✓ Wrote ${targetDate}.raw.json and ${targetDate}.normalized.json`);

// Update meta
let meta = {};
try { meta = JSON.parse(readFileSync(META_PATH, 'utf8')); } catch { /* first run */ }
meta[targetDate] = {
  status:    'cached',
  timestamp: new Date().toISOString(),
  techCount: result.technicians.length,
  stopCount: stats.stopsExtracted,
  source:    'seeded-from-sample',
};
writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
console.log(`[seedRouteCache] ✓ Updated cache-meta.json  (status: cached)\n`);

console.log('[seedRouteCache] Done. Open the CRM and click the date pill to load routes.');
