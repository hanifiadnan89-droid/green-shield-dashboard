/**
 * FieldRoutes extractor test — runs against data/fieldroutes-sample.json
 * Run with: node scripts/testExtractor.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractRoutePayload } from '../client/src/utils/fieldRoutesExtractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const payloadPath = resolve(__dirname, '../data/fieldroutes-sample.json');

let raw;
try {
  raw = JSON.parse(readFileSync(payloadPath, 'utf8'));
} catch (err) {
  console.error(`\n  ERROR: Could not load payload file.`);
  console.error(`  Expected: ${payloadPath}`);
  console.error(`  Detail:   ${err.message}\n`);
  process.exit(1);
}

const { result, stats } = extractRoutePayload(raw);

console.log('\n════════════════════════════════════════════════════════');
console.log('  FieldRoutes Extractor — Real Payload Test');
console.log('════════════════════════════════════════════════════════\n');

console.log(`Date:               ${result.date}`);
console.log(`Group ID:           ${result.groupID}`);
console.log(`Routes found:       ${stats.routesFound}`);
console.log(`Routes with stops:  ${stats.routesWithStops}`);
console.log(`Stops extracted:    ${stats.stopsExtracted}`);
console.log(`Duplicates removed: ${stats.duplicatesRemoved}`);
console.log(`Missing fields:     ${stats.missingFields.length ? stats.missingFields.join(', ') : 'none'}`);

console.log('\n────────────────────────────────────────────────────────');
console.log('  Per-route stop counts\n');

for (const tech of result.technicians) {
  console.log(`  [Route ${tech.routeId}] ${tech.techName || '(no name)'}  —  ${tech.stops.length} stop(s)`);
}

// Show first technician with stops as the detailed example
const example = result.technicians.find(t => t.stops.length > 0);

if (example) {
  console.log('\n────────────────────────────────────────────────────────');
  console.log(`  Example route: ${example.techName} (Route ${example.routeId})\n`);
  console.log(`  Duration: ${example.estimatedTotalDuration}   Distance: ${example.totalDistanceMiles} mi`);
  console.log(`  Start:    lat ${example.startLocation.lat}, lng ${example.startLocation.lng}`);
  console.log(`  Stops (${example.stops.length}):`);

  for (const stop of example.stops) {
    console.log(`\n    [${stop.routeOrder}] ${stop.customerName}${stop.companyName ? ' / ' + stop.companyName : ''}`);
    console.log(`        Appt ID:   ${stop.appointmentId}  |  Customer ID: ${stop.customerId}`);
    console.log(`        Address:   ${stop.address}`);
    console.log(`        Coords:    ${stop.lat}, ${stop.lng}`);
    console.log(`        Service:   ${stop.serviceType} (${stop.serviceCode})  —  ${stop.durationMinutes} min`);
    console.log(`        Window:    ${stop.timeWindow}  |  Spot: ${stop.spotTime} (${stop.spotStartMinutes} min)`);
    console.log(`        Status:    ${stop.status}  |  Commercial: ${stop.isCommercial}`);
    if (stop.callAhead) console.log(`        Call Ahead: ${stop.callAhead}`);
    if (stop.notes)     console.log(`        Notes:     ${stop.notes}`);
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log('  Full normalized JSON for example route:\n');
  console.log(JSON.stringify(example, null, 2));
}

console.log('\n════════════════════════════════════════════════════════\n');
