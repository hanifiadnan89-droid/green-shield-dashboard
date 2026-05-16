import { promises as fs, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractRoutePayload } from '../../client/src/utils/fieldRoutesExtractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR     = resolve(__dirname, '../../data/routes');
const META_PATH      = resolve(ROUTES_DIR, 'cache-meta.json');
const AUTH_STATE     = resolve(__dirname, '../../playwright/.auth/fieldroutes-state.json');
const FIELDROUTES_BASE = 'https://greenshieldpestsolutions.fieldroutes.com';

// ---------------------------------------------------------------------------
// FieldRoutes page fetch via Playwright
//
// Strategy:
//   1. Load day.php?date=YYYY-MM-DD using the saved Playwright auth state.
//   2. The page automatically fires a POST to routeDelegate?action=getGroupData.
//      We intercept that response directly — no need to know tabSession or groupID.
//   3. If the XHR isn't captured (e.g., page fired it before the listener was
//      registered or caching prevented it), fall back to extracting tabSession
//      from the page and posting manually.
//   4. If the session has expired, throw a needs_login error so the meta status
//      is set to 'needs_login' and the widget shows the right badge.
//
// One-time setup:  node scripts/fieldRoutesLogin.mjs
// ---------------------------------------------------------------------------

async function fetchRawPayload(date) {
  if (!existsSync(AUTH_STATE)) {
    throw new Error(
      'needs_login: FieldRoutes auth state not found — ' +
      'run: node scripts/fieldRoutesLogin.mjs'
    );
  }

  let playwrightMod;
  try {
    playwrightMod = await import('playwright');
  } catch {
    throw new Error(
      'Playwright not installed — ' +
      'run: npm install playwright && cd server && npx playwright install chromium'
    );
  }

  const { chromium } = playwrightMod;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    if (err.message?.includes('Executable') || err.message?.includes('executable')) {
      throw new Error(
        'Chromium not installed — run: cd server && npx playwright install chromium'
      );
    }
    throw err;
  }

  const context = await browser.newContext({
    storageState: AUTH_STATE,
    // Suppress unnecessary resource loading
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await context.newPage();

  // Block images/fonts/media to speed up page load — we only need the XHR
  await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,mp4,webm}', r => r.abort());

  try {
    // ── Intercept the routeDelegate XHR that fires on page load ──────────────
    let routePayload = null;

    const capturePromise = new Promise((resolve) => {
      page.on('response', async (response) => {
        if (routePayload) return;
        const url = response.url();
        if (
          url.includes('routeDelegate') &&
          url.includes('getGroupData') &&
          response.status() === 200
        ) {
          try {
            const json = await response.json();
            routePayload = json;
            resolve(json);
          } catch {
            resolve(null);
          }
        }
      });
      // Do not wait forever if the XHR never fires
      setTimeout(() => resolve(null), 20000);
    });

    // Navigate to the day page for the requested date
    await page.goto(`${FIELDROUTES_BASE}/day.php?date=${date}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Detect redirect to login (session expired)
    const currentUrl = page.url();
    if (!currentUrl.includes('day.php')) {
      throw new Error(
        'needs_login: FieldRoutes session expired — ' +
        'run: node scripts/fieldRoutesLogin.mjs'
      );
    }

    routePayload = await capturePromise;

    // ── Fallback: extract tabSession from page, POST manually ─────────────────
    if (!routePayload) {
      console.warn(`[preloader] XHR not intercepted for ${date}, trying tabSession fallback`);

      const tabSession = await page.evaluate(() => {
        // FieldRoutes embeds tabSession as a JS variable or hidden input
        if (typeof window.tabSession !== 'undefined') return String(window.tabSession);
        const el = document.querySelector('input[name="tabSession"]');
        if (el) return el.value;
        // Search inline <script> blocks
        for (const s of document.querySelectorAll('script:not([src])')) {
          const m = s.textContent.match(/tabSession\s*[=:]\s*['"]([^'"]{8,})['"]/);
          if (m) return m[1];
        }
        return null;
      });

      if (!tabSession) {
        throw new Error(
          `Could not extract tabSession from day.php?date=${date} — ` +
          'the page structure may have changed or no routes exist for this date'
        );
      }

      const groupId = process.env.FIELDROUTES_GROUP_ID || '2058';

      // Execute the POST from inside the page so it carries the session cookies
      routePayload = await page.evaluate(
        async ({ groupId, tabSession }) => {
          const resp = await fetch(
            '/resources/delegates/day/routeDelegate?action=getGroupData',
            {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/x-json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
              },
              body: `groupID=${groupId}&tabSession=${tabSession}&action=getGroupData`,
            }
          );
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return resp.json();
        },
        { groupId, tabSession }
      );
    }

    if (!routePayload) {
      throw new Error(`FieldRoutes returned an empty route payload for ${date}`);
    }

    return routePayload;

  } finally {
    await context.close();
    await browser.close();
  }
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
    console.log(`[preloader] ${date} cached — ${result.technicians.length} techs, ${stats.stopsExtracted} stops`);
    return result;
  } catch (err) {
    const msg = err.message || '';
    const status =
      msg.includes('needs_login') || msg.includes('Session expired') || msg.includes('auth state not found')
        ? 'needs_login'
        : msg.includes('not implemented')
        ? 'not_configured'
        : 'failed';
    await updateMeta(date, {
      status,
      timestamp: new Date().toISOString(),
      error: msg,
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
