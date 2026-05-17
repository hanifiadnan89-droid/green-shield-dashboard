/**
 * One-time interactive FieldRoutes login.
 * Saves browser auth state to playwright/.auth/fieldroutes-state.json
 * so the preloader can fetch routes without re-authenticating.
 *
 * Run once (or whenever the session expires):
 *   node scripts/fieldRoutesLogin.mjs
 */

import playwrightPkg from '../server/node_modules/playwright/index.js';
const { chromium } = playwrightPkg;
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR   = resolve(__dirname, '../playwright/.auth');
const AUTH_STATE = resolve(AUTH_DIR, 'fieldroutes-state.json');

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

mkdirSync(AUTH_DIR, { recursive: true });

console.log('\n[FieldRoutes Login] Launching browser...');
const browser = await chromium.launch({ headless: false, slowMo: 50 });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://greenshieldpestsolutions.fieldroutes.com/');

console.log('[FieldRoutes Login] Browser is open.');
console.log('[FieldRoutes Login] Log in to FieldRoutes normally (username + password).');
console.log('[FieldRoutes Login] Auth state will be saved automatically once you reach the dashboard.\n');
console.log('[FieldRoutes Login] Waiting up to 5 minutes — just log in, nothing else needed.\n');

// Give the login page a moment to fully render before we start watching
await page.waitForTimeout(2500);

// Detect login by DOM: wait until there is no password input on the page.
// This works regardless of what URL FieldRoutes uses for its login screen.
try {
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false;
      const pwd = document.querySelector('input[type="password"]');
      return !pwd;
    },
    { timeout: LOGIN_TIMEOUT_MS, polling: 2000 }
  );
} catch {
  console.error('\n[FieldRoutes Login] ✗ Timed out waiting for login. Please re-run the script and log in within 5 minutes.\n');
  await browser.close();
  process.exit(1);
}

// Extra brief pause to let the dashboard finish loading cookies
await page.waitForTimeout(1500);

await context.storageState({ path: AUTH_STATE });
console.log(`\n[FieldRoutes Login] ✓ Auth state saved to: ${AUTH_STATE}`);
console.log('[FieldRoutes Login]   The server can now fetch FieldRoutes route data.\n');
console.log('   Next steps:');
console.log('   1. Restart the server: npm start (in the server/ directory)');
console.log('   2. The Route Finder will auto-preload today\'s routes on next CRM open.\n');

await browser.close();
process.exit(0);
