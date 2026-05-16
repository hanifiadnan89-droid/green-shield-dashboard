/**
 * Route scorer test — run with: node scripts/testScorer.mjs
 * Loads the real FieldRoutes payload, extracts routes, then scores
 * three test leads and prints top-3 matches for each.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractRoutePayload } from '../client/src/utils/fieldRoutesExtractor.js';
import { scoreRoutes }         from '../client/src/utils/fieldRoutesScorer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(resolve(__dirname, '../data/fieldroutes-sample.json'), 'utf8')
);

const { result } = extractRoutePayload(raw);
const techs = result.technicians;

// ---------------------------------------------------------------------------
// Test leads
// ---------------------------------------------------------------------------
const TEST_LEADS = [
  {
    label:                'Residential — York, ME (AT)',
    lat:                  43.155,
    lng:                  -70.647,
    serviceType:          'Regular Service',
    durationMinutes:      30,
    timeWindowPreference: 'AT',
  },
  {
    label:                'Commercial — Cape Neddick, ME (AM)',
    lat:                  43.195,
    lng:                  -70.591,
    serviceType:          'Commercial Monthly',
    durationMinutes:      30,
    timeWindowPreference: 'AM',
  },
  {
    label:                'Residential — Ogunquit, ME (PM)',
    lat:                  43.240,
    lng:                  -70.582,
    serviceType:          'Initial Service',
    durationMinutes:      60,
    timeWindowPreference: 'PM',
  },
];

// ---------------------------------------------------------------------------
// Print helper
// ---------------------------------------------------------------------------
function printResults(scoring) {
  const { lead, prefWindow, totalRoutesScored, topMatches, allScores } = scoring;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Lead: ${lead.label}`);
  console.log(`  Coords: ${lead.lat}, ${lead.lng}`);
  console.log(`  Service: ${lead.serviceType} — ${lead.durationMinutes} min`);
  console.log(`  Window: ${prefWindow.label} (${prefWindow.startTime} – ${prefWindow.endTime})`);
  console.log(`  Routes scored: ${totalRoutesScored}`);
  console.log(`${'─'.repeat(60)}`);

  for (const m of topMatches) {
    const ins = m.bestInsertion;
    console.log(`\n  #${m.rank} ${m.techName}  (Route ${m.routeId})`);
    console.log(`     Score:    ${m.scores.total}/100  ` +
      `[geo=${m.scores.geographic} travel=${m.scores.travelEfficiency} ` +
      `window=${m.scores.timeWindow} cap=${m.scores.capacity}]`);
    console.log(`     Nearest stop: ${m.nearestStopMiles} mi`);
    console.log(`     Capacity:     ${m.capacity.currentHours}h used / ${m.capacity.maxHours}h max  ` +
      `(${m.capacity.remainingHours}h remaining)`);
    if (ins) {
      const after = ins.afterCustomerName  ? `after ${ins.afterCustomerName}` : 'at start of route';
      const before = ins.beforeCustomerName ? ` / before ${ins.beforeCustomerName}` : '';
      console.log(`     Insert:       ${after}${before}`);
      console.log(`     Est. arrival: ${ins.estimatedArrivalTime}  (detour ${ins.detourMiles} mi${ins.viable ? '' : '  ⚠ tight fit'})`);
    }
  }

  console.log(`\n  All route scores:`);
  const cols = 4;
  for (let i = 0; i < allScores.length; i += cols) {
    const row = allScores.slice(i, i + cols)
      .map(s => `${s.techName.split(' ')[0].padEnd(10)} ${String(s.total).padStart(3)}`)
      .join('   ');
    console.log(`    ${row}`);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
for (const lead of TEST_LEADS) {
  const result = scoreRoutes(techs, lead);
  printResults(result);
}

console.log(`\n${'═'.repeat(60)}\n`);
