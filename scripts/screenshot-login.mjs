/**
 * Playwright screenshot for the Green Shield Control Center login landing.
 * Run (with the server already running on PORT=3781):
 *   node scripts/screenshot-login.mjs
 */
import pkg from '../server/node_modules/playwright/index.js';
const { chromium } = pkg;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../screenshots/login-landing');
mkdirSync(OUT, { recursive: true });

const URL = process.env.GS_URL || 'http://localhost:3781/';

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: false });
  console.log(`  → ${name}.png`);
}

const browser = await chromium.launch();
try {
  // Desktop
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dpage = await desktop.newPage();
  await dpage.goto(URL, { waitUntil: 'networkidle' });
  await dpage.waitForSelector('.login-card', { timeout: 5000 });
  await dpage.waitForTimeout(800); // let fade-in settle
  await shot(dpage, 'login-desktop-1440x900');

  // Error state
  await dpage.fill('#login-username', 'wronguser');
  await dpage.fill('#login-password', 'wrongpass');
  await dpage.click('.login-submit');
  await dpage.waitForSelector('.login-error', { timeout: 5000 });
  await dpage.waitForTimeout(400);
  await shot(dpage, 'login-desktop-error');

  // Focused field
  await dpage.fill('#login-username', '');
  await dpage.fill('#login-password', '');
  await dpage.focus('#login-username');
  await dpage.fill('#login-username', 'tester');
  await dpage.waitForTimeout(200);
  await shot(dpage, 'login-desktop-focused');

  // Mobile
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(URL, { waitUntil: 'networkidle' });
  await mpage.waitForSelector('.login-card', { timeout: 5000 });
  await mpage.waitForTimeout(800);
  await shot(mpage, 'login-mobile-390x844');

  console.log(`\nScreenshots saved to ${OUT}`);
} finally {
  await browser.close();
}
