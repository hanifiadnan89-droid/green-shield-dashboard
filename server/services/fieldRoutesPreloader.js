import { promises as fs, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractRoutePayload } from '../../client/src/utils/fieldRoutesExtractor.js';
import { getAuthStatus, setAuthStatus } from './fieldRoutesAuth.js';
import { launchFieldRoutesChromium } from './playwrightRuntime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR       = resolve(__dirname, '../../data/routes');
const META_PATH        = resolve(ROUTES_DIR, 'cache-meta.json');
const AUTH_STATE       = resolve(__dirname, '../../playwright/.auth/fieldroutes-state.json');
const FIELDROUTES_BASE = 'https://greenshieldpestsolutions.fieldroutes.com';

function fmtTime12h(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

async function getStorageStateForPlaywright() {
  const envRaw = (process.env.FIELDROUTES_AUTH_STATE_JSON || '').trim();
  if (envRaw) {
    try {
      return JSON.parse(envRaw);
    } catch (err) {
      throw new Error(`needs_login: FIELDROUTES_AUTH_STATE_JSON is not valid JSON: ${err.message}`);
    }
  }

  if (!existsSync(AUTH_STATE)) {
    throw new Error(
      'needs_login: FieldRoutes auth state not found — ' +
      'run: node scripts/fieldRoutesLogin.mjs'
    );
  }

  return AUTH_STATE;
}

async function fetchRawPayload(date) {
  const storageState = await getStorageStateForPlaywright();

  const browser = await launchFieldRoutesChromium();

  const context = await browser.newContext({
    storageState,
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await context.newPage();

  await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,eot,mp4,webm}', r => r.abort());

  try {
    let routePayload = null;

    const capturePromise = new Promise((resolve) => {
      page.on('response', async (response) => {
        if (routePayload) return;
        const url = response.url();
        if (url.includes('routeDelegate') && url.includes('getGroupData') && response.status() === 200) {
          try {
            const json = await response.json();
            routePayload = json;
            resolve(json);
          } catch {
            resolve(null);
          }
        }
      });
      setTimeout(() => resolve(null), 20000);
    });

    await page.goto(`${FIELDROUTES_BASE}/day.php?date=${date}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const currentUrl = page.url();
    if (!currentUrl.includes('day.php')) {
      throw new Error('needs_login: FieldRoutes session expired — update FIELDROUTES_AUTH_STATE_JSON in Render');
    }

    routePayload = await capturePromise;

    if (!routePayload) {
      console.warn(`[preloader] XHR not intercepted for ${date}, trying tabSession fallback`);

      const tabSession = await page.evaluate(() => {
        if (typeof window.tabSession !== 'undefined') return String(window.tabSession);
        const el = document.querySelector('input[name="tabSession"]');
        if (el) return el.value;
        for (const s of document.querySelectorAll('script:not([src])')) {
          const m = s.textContent.match(/tabSession\s*[=:]\s*['"]([^'"]{8,})['"]/);
          if (m) return m[1];
        }
        return null;
      });

      if (!tabSession) {
        throw new Error(`Could not extract tabSession from day.php?date=${date} — page loaded but route session data was not found`);
      }

      const groupId = process.env.FIELDROUTES_GROUP_ID || '2058';

      routePayload = await page.evaluate(
        async ({ groupId, tabSession }) => {
          const resp = await fetch('/resources/delegates/day/routeDelegate?action=getGroupData', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/x-json;charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: `groupID=${groupId}&tabSession=${tabSession}&action=getGroupData`,
          });
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

function getLocalDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function getNextSixWorkingDays() {
  const dates = [];
  let offset = 0;
  while (dates.length < 6) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    if (d.getDay() !== 0) dates.push(getLocalDateStr(offset));
    offset++;
  }
  return dates;
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

let _metaQueue = Promise.resolve();
function withMetaLock(fn) {
  const task = _metaQueue.then(fn);
  _metaQueue = task.catch(() => {});
  return task;
}

async function updateMeta(date, fields) {
  return withMetaLock(async () => {
    const meta = await readMeta();
    meta[date] = { ...(meta[date] || {}), ...fields };
    await writeMeta(meta);
  });
}

async function replaceMeta(date, entry) {
  return withMetaLock(async () => {
    const meta = await readMeta();
    meta[date] = entry;
    await writeMeta(meta);
  });
}

export async function refreshDate(date) {
  const auth = getAuthStatus();
  if (auth.status === 'needs_login') {
    await updateMeta(date, {
      status: 'needs_login',
      timestamp: new Date().toISOString(),
      error: 'FieldRoutes session expired — update FIELDROUTES_AUTH_STATE_JSON in Render.',
    });
    throw new Error('needs_login: FieldRoutes session is not authenticated.');
  }

  console.log(`[preloader] Refresh starting for ${date}`);
  await updateMeta(date, { status: 'refreshing', timestamp: new Date().toISOString() });
  try {
    const raw = await fetchRawPayload(date);
    await fs.mkdir(ROUTES_DIR, { recursive: true });
    await fs.writeFile(resolve(ROUTES_DIR, `${date}.raw.json`), JSON.stringify(raw, null, 2));
    const { result, stats } = extractRoutePayload(raw);
    await fs.writeFile(resolve(ROUTES_DIR, `${date}.normalized.json`), JSON.stringify(result, null, 2));
    await replaceMeta(date, {
      status: 'cached',
      timestamp: new Date().toISOString(),
      techCount: result.technicians.length,
      stopCount: stats.stopsExtracted,
    });
    setAuthStatus('ok');
    console.log(`[preloader] ${date} cached — ${result.technicians.length} techs, ${stats.stopsExtracted} stops`);
    return result;
  } catch (err) {
    const msg = err.message || '';
    console.error(`[preloader] ${date} failed:`, msg);
    const isAuthError = msg.includes('needs_login') || msg.includes('Session expired') || msg.includes('auth state not found');
    const status = isAuthError ? 'needs_login' : msg.includes('not implemented') ? 'not_configured' : 'failed';
    if (isAuthError) setAuthStatus('needs_login', 'FieldRoutes session expired during scrape.');
    await updateMeta(date, { status, timestamp: new Date().toISOString(), error: msg });
    throw err;
  }
}

export async function getStatus() {
  const dates = getNextSixWorkingDays();
  const meta  = await readMeta();
  const result = {};
  for (const date of dates) result[date] = meta[date] || { status: 'missing' };

  const lastRefresh = Object.values(meta)
    .filter(e => e?.status === 'cached' && e?.timestamp)
    .map(e => e.timestamp)
    .sort()
    .reverse()[0] ?? null;

  const auth = getAuthStatus();
  result._auth = {
    status: auth.status,
    lastCheck: auth.lastCheck,
    lastCheckFormatted: fmtTime12h(auth.lastCheck),
    message: auth.message,
    lastRefresh,
    lastRefreshFormatted: fmtTime12h(lastRefresh),
  };
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

export async function preloadNextSixWorkingDays({ force = false } = {}) {
  const auth = getAuthStatus();
  if (auth.status === 'needs_login') {
    console.warn('[preloader] Skipping preload — FieldRoutes auth needs login.');
    const dates = getNextSixWorkingDays();
    const meta  = await readMeta();
    const needsUpdate = dates.filter(d => {
      const s = meta[d]?.status;
      return !s || s === 'missing' || s === 'refreshing';
    });
    if (needsUpdate.length > 0) {
      await withMetaLock(async () => {
        const m = await readMeta();
        for (const d of needsUpdate) {
          m[d] = {
            ...(m[d] || {}),
            status: 'needs_login',
            timestamp: new Date().toISOString(),
            error: 'FieldRoutes session expired — update FIELDROUTES_AUTH_STATE_JSON in Render.',
          };
        }
        await writeMeta(m);
      });
    }
    return;
  }

  const dates = getNextSixWorkingDays();
  const meta  = await readMeta();
  for (const date of dates) {
    if (!force) {
      const entry = meta[date];
      if (entry?.status === 'cached' && entry?.timestamp) {
        const ageMs = Date.now() - new Date(entry.timestamp).getTime();
        if (ageMs < 6 * 60 * 60 * 1000) continue;
      }
    }
    try {
      await refreshDate(date);
    } catch (err) {
      if (err.message?.includes('needs_login')) {
        console.warn('[preloader] Auth expired mid-preload — stopping remaining dates.');
        break;
      }
    }
  }
}
