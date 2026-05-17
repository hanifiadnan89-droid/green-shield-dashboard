# Green Shield CRM — Bot Handoff (2026-05-17)

## Project Overview

**Green Shield Pest Solutions** CRM dashboard. Full-stack: React + Vite (client), Express (server), Google Sheets as database, FieldRoutes (pest-industry SaaS) as route data source.

- **Root:** `/Users/adnanhanifi/green-shield-dashboard`
- **Client:** `client/` (React/Vite, runs on port 5173)
- **Server:** `server/` (Express, runs on port 3001)
- **Active branch:** `feature/update-0516-1341` — **not yet merged to main**

To start both servers:
```bash
cd ~/green-shield-dashboard && bash start.sh
```

---

## Architecture

```
Google Sheets (backend DB)          FieldRoutes (pest SaaS)
        ↓                                    ↓
server/routes/leads.js          server/services/fieldRoutesPreloader.js
        ↓                          (Playwright scraper → data/routes/*.json)
client/src/api/client.js                     ↓
        ↓                          GET /api/routes/payload?date=
client/src/pages/CRMPreview/                 ↓
  index.jsx (layout root)        client/src/utils/fieldRoutesScorer.js
  ├── SalesSummaryBar.jsx                     ↓
  ├── PipelineSummary.jsx        RouteFinderWidget.jsx (top-right panel)
  └── LeadPipeline.jsx
```

---

## Layout (CRMPreview)

```
SalesSummaryBar                             (full width, 4 clickable stat cards)
PipelineSummary (col-span-8)  |  RouteFinderWidget (col-span-4)  ← top-right
LeadPipeline    (col-span-8)  |  PriorityQueue     (col-span-4)  ← bottom-right
```

---

## Data Model — Google Sheets

Columns A through L:
```
A: name  B: email  C: notes  D: status  E: sent  F: error
G: stop  H: phone  I: sms_reply  J: email_reply  K: sold  L: deleted
```
- `sold = 'yes'` → sold
- `deleted = 'yes'` → soft-deleted; filtered out on fetch
- Range is `A:L` everywhere (getLeads, updateLead, appendLead)

---

## What Was Built in This Session (2026-05-17)

### 1. Route Finder Scorer Rewrite (`client/src/utils/fieldRoutesScorer.js`)

**Problem fixed:** The old scorer had an end-of-route bias — it always ranked "insert after last stop" first because that position has no downstream timed stops (timedRisk: 'none'), even when a mid-route insertion was geographically closer.

**New approach — weighted candidate score (lower = better):**
```js
function insertionCandidateScore(c, prefStart, prefEnd, durationMin) {
  let score = 0;
  if (!c.eodSafe)           score += 1000;   // hard gate: 6 PM cutoff
  if (c.timedRisk === 'high') score += 500;  // hard gate: timed appointment violation
  score += c.detourMiles * 10;               // PRIMARY — geographic detour in miles
  score += c.localProximityMiles * 5;        // distance to nearest bounding stop
  if (c.timedRisk === 'medium') score += 50;
  if (c.timedRisk === 'low')    score += 20;
  const inWindow = c.estimatedArrivalMin >= prefStart && c.estimatedArrivalMin + durationMin <= prefEnd;
  if (!inWindow)                score += 15;
  score -= c.clusterDensity * 2;             // bonus for clustered routes
  if (!c.viable)                score += 10;
  if (c.causesBacktracking)     score += 10 + c.backtrackingSeverity * 10;
  return score;
}
```

**New fields added to each insertion candidate:**
- `localProximityMiles` — min(dist to prev stop, dist to next stop). For "before first": dist to first. For "after last": dist to last.

**New fields added to each route result (`scoreRoute` output):**
- `closestStop` — the route stop nearest the new lead (with `customerName`, `distanceMiles`, `scheduledTime`, `stopIndex`)
- `clusterLabel` — e.g. `"Strong cluster (4 nearby stops within 5 mi)"`
- `bestInsertion.localProximityMiles`
- `bestInsertion.insertionPositionLabel` — e.g. `"After stop 4 of 8"` or `"After stop 8 of 8 (end of route)"`
- `bestInsertion.timedSafetyLabel` — human-readable timed appointment verdict
- `bestInsertion.eodLabel` — human-readable EOD status
- `scores.insertionProximity` — 0–100 score for score breakdown

**5th score column added:** Score breakdown now shows `Geo / Drive / Win / Cap / Ins` (was 4 columns).

**`buildReason()` updated** to mention closest stop by name, scheduled time, cluster label, and insertion position in the explanation text.

---

### 2. FieldRoutes Auth System (`server/services/fieldRoutesAuth.js` — new file)

**Problem solved:** FieldRoutes uses PHP server-side sessions that expire after ~1–4 hours of idle time, requiring manual re-login between nightly scrapes.

**New file: `server/services/fieldRoutesAuth.js`**
- `loadAuthStatus()` — reads `data/fieldroutes-auth-status.json` on startup to restore last known status
- `getAuthStatus()` — returns in-memory status (fast, no I/O)
- `setAuthStatus(status, message)` — updates memory + persists to disk (fire-and-forget)
- `checkAuthHealth()` — lightweight HTTP fetch to `day.php` using Playwright-saved cookies. No browser process. Detects login redirects, login-page false-positives, and HTTP errors. Completes in ~300–800ms.
- `startAuthKeepalive(intervalMs = 45min)` — pings FieldRoutes every 45 minutes to reset PHP session idle timer. Skips when `status === 'needs_login'`. Calls `.unref()` for clean Node.js exit.
- `stopAuthKeepalive()` — clears the interval

**Auth state files:**
- `playwright/.auth/fieldroutes-state.json` — Playwright session cookies (gitignored)
- `data/fieldroutes-auth-status.json` — last known auth status (gitignored via `data/*.json`)

**Integration points:**
- `server/index.js`: calls `loadAuthStatus()`, `checkAuthHealth()`, `startAuthKeepalive()` at startup
- `server/routes/routes.js`: `GET /api/routes/auth-status`, `POST /api/routes/auth-check`
- `server/services/fieldRoutesPreloader.js`: auth guard in `preloadNextSixWorkingDays()` — if `needs_login`, marks pending dates and returns early without launching any browsers
- `server/services/fieldRoutesCron.js`: 9 PM cron checks auth first; skips if not ok

**`getStatus()` always appends `_auth` key** to the `/api/routes/status` response:
```json
{
  "2026-05-19": { "status": "cached", ... },
  "_auth": {
    "status": "ok",
    "lastCheck": "2026-05-17T14:23:00.000Z",
    "lastCheckFormatted": "2:23 PM",
    "lastRefresh": "...",
    "lastRefreshFormatted": "..."
  }
}
```

**Client API additions** (`client/src/api/client.js`):
```js
routes.authStatus: () => request('/routes/auth-status')
routes.authCheck:  () => request('/routes/auth-check', { method: 'POST' })
```

---

### 3. Auth Status Banner Fix (`RouteFinderWidget.jsx`)

**Problem:** Auth status message would "show briefly then disappear." Three root causes:
1. `useState(null)` → `{authInfo && (...)}` gate — section invisible until first async poll resolves
2. React StrictMode double-mount — second mount resets state to `null`, erasing the section
3. IIFE pattern `{authInfo && (() => {...})()}` — fragile closure, recreated every render

**Fix:**
- `authInfo` now initializes to `{ status: 'checking' }` (always truthy)
- Extracted `AuthStatusBanner` as a **standalone component** above `RouteFinderWidget` — stable reconciliation, never disappears
- Removed all `authInfo &&` conditional gates
- Handles all statuses: `checking` (grey, "Checking…") | `ok` (green, "Connected") | `needs_login` (amber, "Needs Login" + login command) | `failed` (red, "Failed" + message) | `unknown` (amber fallback)

**`applyStatusData` helper** splits `_auth` out of the status response and applies both:
```js
const applyStatusData = useCallback((statusData) => {
  const { _auth, ...dateStatuses } = statusData;
  setDateStatus(dateStatuses);
  if (_auth) setAuthInfo(_auth);
}, []);
```

---

## Key File Map

| File | Role |
|------|------|
| `client/src/pages/CRMPreview/index.jsx` | Layout root, data fetching, 30s lead refresh |
| `client/src/pages/CRMPreview/components/RouteFinderWidget.jsx` | Route finder UI (date picker, geocoder, results) |
| `client/src/utils/fieldRoutesScorer.js` | Scoring engine — 870 lines |
| `client/src/pages/CRMPreview/components/PipelineSummary.jsx` | Analytics panel (donut chart) |
| `client/src/pages/CRMPreview/components/LeadPipeline.jsx` | Lead table with status + day filter chips |
| `client/src/pages/CRMPreview/components/LeadRow.jsx` | Single lead row with quick actions |
| `client/src/pages/CRMPreview/components/SalesSummaryBar.jsx` | 4 stat cards at top |
| `client/src/api/client.js` | All API calls |
| `client/src/pages/CRMPreview/mockData.js` | `deriveStats()`, `daysSince()` (exported) |
| `server/index.js` | Express entry point, startup hooks |
| `server/routes/leads.js` | CRUD + stop/unstop/delete |
| `server/routes/routes.js` | Route cache endpoints + auth endpoints |
| `server/services/fieldRoutesAuth.js` | Auth health check + keepalive |
| `server/services/fieldRoutesPreloader.js` | Playwright scraper, 6-day cache, `withMetaLock` |
| `server/services/fieldRoutesCron.js` | 9 PM nightly preload cron |
| `server/services/sheets.js` | Google Sheets read/write |

---

## Important Rules / Invariants

**Git:**
- Always feature branch + PR, never push direct to `main`
- Active branch: `feature/update-0516-1341` — has all session work, not yet PR'd

**Day filter chips in LeadPipeline:**
- Day 1/2/3+ chips are **right-aligned** with a `borderLeft` divider, `shrink-0`
- They are **not** in the same flex-wrap group as status filters
- Do not move them left or merge into the status chip group

**Scoring / Route Finder:**
- `WORKDAY_END = 1080` (6 PM) — hard cutoff
- `NH_CONFIG.approvedTechNames = ['Alex Gray']`, `approvedTechIds = [10068]` — NH leads only go to Alex Gray
- `W = { geo: 0.20, travel: 0.40, window: 0.30, capacity: 0.10 }` — final route score weights
- `insertionCandidateScore` uses `detourMiles * 10` as primary sort — do not change without re-validating end-of-route bias

**Cache / Preloader:**
- `withMetaLock` must wrap all `cache-meta.json` reads/writes — do not bypass
- `force=true` on `/routes/preload` bypasses the 6h freshness check — used by the manual "Refresh All" button
- Route data files (`data/*.json`) are gitignored — never commit them

**Soft delete only:**
- `deleted = 'yes'` on the sheet row — row numbers must stay stable for all other updates
- Never physically remove rows

**React:**
- `PipelineSummaryChart.jsx` is an orphaned file — do not import it
- `loadingRef` in `index.jsx` guards the 30s background leads refresh — do not remove it
- Auth section must always be visible — `AuthStatusBanner` is always mounted, never conditional

---

## FieldRoutes Login (when session expires)

```bash
cd ~/green-shield-dashboard && node scripts/fieldRoutesLogin.mjs
```

The widget shows "Needs Login" when `authInfo.status === 'needs_login'` and displays this command inline.

---

## Pending / Potential Next Work

- **PR for this branch** — `feature/update-0516-1341` has all session work. Normal flow: create PR → merge to main.
- **Verify scorer live** — the anti-end-of-route bias fix should be confirmed with a real address where a technician has a mid-route stop nearby.
- **Route cache status line** — user may want "Cached · Last Updated: [time]" shown in the auth banner after a successful refresh (was mentioned in last session requirements but deferred).
- **Score breakdown 5th column (Ins)** — added to `ResultCard` but `PipelineSummaryChart.jsx` is unrelated.

---

## Dev Notes

- `start.sh` starts both client (Vite) and server (nodemon) concurrently
- Server env vars in `server/.env`: `SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_FILE`, `N8N_BASE_URL`, `TEST_MODE`
- `TEST_MODE=true` disables live Google Sheets writes
- Playwright cookies live at `playwright/.auth/fieldroutes-state.json` — gitignored
