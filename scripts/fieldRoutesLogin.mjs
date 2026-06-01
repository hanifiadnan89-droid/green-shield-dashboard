/**
 * Interactive FieldRoutes login — opens Chromium for manual sign-in.
 * Saves auth state to playwright/.auth/fieldroutes-state.json
 *
 * Run: node scripts/fieldRoutesLogin.mjs
 */

import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const AUTH_DIR = resolve(PROJECT_ROOT, 'playwright/.auth');
const AUTH_STATE = resolve(AUTH_DIR, 'fieldroutes-state.json');
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

async function loadChromium() {
  const playwrightEntry = pathToFileURL(
    resolve(PROJECT_ROOT, 'server/node_modules/playwright/index.js'),
  ).href;
  const playwrightPkg = await import(playwrightEntry);
  const chromium = playwrightPkg.chromium ?? playwrightPkg.default?.chromium;
  if (!chromium) {
    throw new Error('Playwright Chromium module not found. Run: cd server && npm install && npm run playwright:install');
  }
  const executablePath = chromium.executablePath();
  if (!existsSync(executablePath)) {
    throw new Error(
      `Chromium is not installed (expected at ${executablePath}). Run: cd server && npm run playwright:install`,
    );
  }
  return chromium;
}

mkdirSync(AUTH_DIR, { recursive: true });

let browser;
try {
  const chromium = await loadChromium();
  console.log('\n[FieldRoutes Login] Launching browser...');
  browser = await chromium.launch({ headless: false, slowMo: 50 });
} catch (err) {
  console.error(`\n[FieldRoutes Login] ✗ ${err.message}\n`);
  process.exit(1);
}

const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://greenshieldpestsolutions.fieldroutes.com/');

console.log('[FieldRoutes Login] Browser is open.');
console.log('[FieldRoutes Login] Log in to FieldRoutes normally (username + password).');
console.log('[FieldRoutes Login] Auth state will be saved automatically once you reach the dashboard.\n');
console.log('[FieldRoutes Login] Waiting up to 5 minutes — just log in, nothing else needed.\n');

await page.waitForTimeout(2500);

try {
  await page.waitForFunction(
    () => {
      if (document.readyState !== 'complete') return false;
      const pwd = document.querySelector('input[type="password"]');
      return !pwd;
    },
    { timeout: LOGIN_TIMEOUT_MS, polling: 2000 },
  );
} catch {
  console.error('\n[FieldRoutes Login] ✗ Timed out waiting for login. Please re-run and log in within 5 minutes.\n');
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1500);

await context.storageState({ path: AUTH_STATE });
console.log(`\n[FieldRoutes Login] ✓ Auth state saved to: ${AUTH_STATE}`);
console.log('[FieldRoutes Login]   Return to the dashboard and click “Check Login”.\n');

await browser.close();
process.exit(0);
