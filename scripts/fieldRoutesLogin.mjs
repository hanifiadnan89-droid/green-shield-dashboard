/**
 * One-time interactive FieldRoutes login.
 * Saves browser auth state to playwright/.auth/fieldroutes-state.json
 * so the preloader can fetch routes without re-authenticating.
 *
 * Run once (or whenever the session expires):
 *   node scripts/fieldRoutesLogin.mjs
 */

import { chromium } from '../server/node_modules/playwright/index.js';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR   = resolve(__dirname, '../playwright/.auth');
const AUTH_STATE = resolve(AUTH_DIR, 'fieldroutes-state.json');

mkdirSync(AUTH_DIR, { recursive: true });

console.log('\n[FieldRoutes Login] Launching browser...');
const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://greenshieldpestsolutions.fieldroutes.com/');

console.log('[FieldRoutes Login] A browser window has opened.');
console.log('[FieldRoutes Login] Log in to FieldRoutes normally (username + password).');
console.log('[FieldRoutes Login] Once you see the dashboard, return here and press Enter.\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
await rl.question('Press Enter when you are logged in and on the FieldRoutes dashboard... ');
rl.close();

// Verify we are not still on the login page
const currentUrl = page.url();
if (currentUrl.includes('login') || currentUrl.includes('index.php')) {
  console.error('\n[FieldRoutes Login] ✗ Still on login page. Please log in first, then re-run this script.\n');
  await browser.close();
  process.exit(1);
}

await context.storageState({ path: AUTH_STATE });
console.log(`\n[FieldRoutes Login] ✓ Auth state saved to: ${AUTH_STATE}`);
console.log('[FieldRoutes Login]   The server can now fetch FieldRoutes route data.\n');
console.log('   Next steps:');
console.log('   1. Restart the server: npm start (in the server/ directory)');
console.log('   2. The Route Finder will auto-preload today\'s routes on next CRM open.\n');

await browser.close();
process.exit(0);
