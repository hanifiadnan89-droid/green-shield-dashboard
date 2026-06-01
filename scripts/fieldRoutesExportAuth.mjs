#!/usr/bin/env node
/**
 * Export Playwright FieldRoutes auth state as a single-line JSON string
 * for FIELDROUTES_AUTH_STATE_JSON on Render.
 *
 * Usage:
 *   npm run fieldroutes:export-auth
 *   node scripts/fieldRoutesExportAuth.mjs
 *
 * Prerequisite: run node scripts/fieldRoutesLogin.mjs first on your Mac.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_STATE = resolve(__dirname, '../playwright/.auth/fieldroutes-state.json');

if (!existsSync(AUTH_STATE)) {
  console.error('\n✗ Auth file not found:', AUTH_STATE);
  console.error('  Run on your Mac first:  node scripts/fieldRoutesLogin.mjs\n');
  process.exit(1);
}

let state;
try {
  state = JSON.parse(readFileSync(AUTH_STATE, 'utf8'));
} catch (err) {
  console.error('\n✗ Could not parse auth file:', err.message, '\n');
  process.exit(1);
}

const cookies = state.cookies || [];
const frCookies = cookies.filter((c) => (c.domain || '').includes('fieldroutes.com'));
const oneLine = JSON.stringify(state);

console.log('\n══════════════════════════════════════════════════════════════');
console.log(' FieldRoutes auth — copy for Render FIELDROUTES_AUTH_STATE_JSON');
console.log('══════════════════════════════════════════════════════════════\n');
console.log(`  Cookies: ${cookies.length} total, ${frCookies.length} for fieldroutes.com`);
if (frCookies.length === 0) {
  console.error('  ✗ No FieldRoutes cookies — log in again with fieldRoutesLogin.mjs\n');
  process.exit(1);
}
console.log(`  JSON size: ${oneLine.length} characters (one line)\n`);
console.log('── Paste this ENTIRE line into Render → Environment ──\n');
console.log(oneLine);
console.log('\n── Then ──');
console.log('  1. Save the environment variable in Render');
console.log('  2. Wait for redeploy / Manual Deploy (env changes restart the service)');
console.log('  3. Open your Render dashboard → Route Finder → click "Check Login"\n');
console.log('Optional: save to a local file (do not commit):');
console.log('  npm run fieldroutes:export-auth > /tmp/fieldroutes-auth-oneline.txt\n');
