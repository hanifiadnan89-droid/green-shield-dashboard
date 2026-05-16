/**
 * Live integration test for the FieldRoutes route preloader.
 * Runs the full pipeline: Playwright fetch → extractor → cache write → verify.
 *
 * Usage:
 *   node scripts/testLiveRefresh.mjs [YYYY-MM-DD]   (defaults to today)
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { refreshDate } from '../server/services/fieldRoutesPreloader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(__dirname, '../data/routes');
const META_PATH  = resolve(ROUTES_DIR, 'cache-meta.json');

// ── Date ──────────────────────────────────────────────────────────────────────
const argDate = process.argv[2];
let testDate;
if (argDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(argDate)) {
    console.error('Date must be YYYY-MM-DD'); process.exit(1);
  }
  testDate = argDate;
} else {
  const d = new Date();
  testDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  FieldRoutes Live Refresh Test`);
console.log(`  Date: ${testDate}`);
console.log(`${'─'.repeat(60)}\n`);

// ── Step 1: Run the live fetch + cache write ──────────────────────────────────
console.log('[1/4] Launching Playwright and fetching live routes...');
const startMs = Date.now();

let result;
try {
  result = await refreshDate(testDate);
} catch (err) {
  console.error(`\n✗ refreshDate failed: ${err.message}\n`);
  // Show current meta status so we know what was set
  if (existsSync(META_PATH)) {
    const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
    const entry = meta[testDate];
    if (entry) console.error(`  Cache meta status: ${entry.status}`);
  }
  process.exit(1);
}

const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
console.log(`    ✓ Fetch + cache complete in ${elapsed}s`);

// ── Step 2: Verify raw payload written to disk ────────────────────────────────
console.log('\n[2/4] Verifying raw payload on disk...');
const rawPath  = resolve(ROUTES_DIR, `${testDate}.raw.json`);
const normPath = resolve(ROUTES_DIR, `${testDate}.normalized.json`);

if (!existsSync(rawPath)) {
  console.error(`  ✗ Missing: ${rawPath}`); process.exit(1);
}
if (!existsSync(normPath)) {
  console.error(`  ✗ Missing: ${normPath}`); process.exit(1);
}

const rawSize  = (readFileSync(rawPath).length / 1024).toFixed(1);
const normSize = (readFileSync(normPath).length / 1024).toFixed(1);
console.log(`    ✓ ${testDate}.raw.json        ${rawSize} KB`);
console.log(`    ✓ ${testDate}.normalized.json  ${normSize} KB`);

// ── Step 3: Inspect extracted technicians ────────────────────────────────────
console.log('\n[3/4] Inspecting extracted route data...');
const techs = result.technicians;
console.log(`    Technicians:  ${techs.length}`);
const totalStops = techs.reduce((n, t) => n + t.stops.length, 0);
const geocodedStops = techs.reduce((n, t) => n + t.stops.filter(s => s.lat && s.lng).length, 0);
console.log(`    Total stops:  ${totalStops}  (${geocodedStops} geocoded)`);

if (techs.length > 0) {
  const sample = techs[0];
  console.log(`\n    Sample technician: ${sample.techName} (route ${sample.routeId})`);
  console.log(`      Stop count:      ${sample.stops.length}`);
  console.log(`      Capacity:        ${sample.routeDurationCapacityRaw || 'n/a'}`);
  if (sample.stops.length > 0) {
    const s = sample.stops[0];
    console.log(`      First stop:      ${s.customerName}`);
    console.log(`        Address:       ${s.address}`);
    console.log(`        Start/End:     ${s.startTime} – ${s.endTime}`);
    console.log(`        Coords:        ${s.lat != null ? `${s.lat}, ${s.lng}` : 'not geocoded'}`);
  }
}

// ── Step 4: Verify cache meta ─────────────────────────────────────────────────
console.log('\n[4/4] Verifying cache-meta.json...');
const meta = JSON.parse(readFileSync(META_PATH, 'utf8'));
const entry = meta[testDate];
console.log(`    status:    ${entry.status}`);
console.log(`    timestamp: ${entry.timestamp}`);
console.log(`    techCount: ${entry.techCount}`);
console.log(`    stopCount: ${entry.stopCount}`);

if (entry.status !== 'cached') {
  console.error(`\n✗ Expected status "cached", got "${entry.status}"`);
  process.exit(1);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`  ✓ All 4 steps passed.`);
console.log(`  The Route Finder can now serve ${techs.length} technicians`);
console.log(`  via GET /api/routes/payload?date=${testDate}`);
console.log(`${'─'.repeat(60)}\n`);
