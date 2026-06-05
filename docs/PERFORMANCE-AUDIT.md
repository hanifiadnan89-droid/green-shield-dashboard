# CRM performance audit (2026-06)

## Symptoms reported

- Laggy / stuttery navigation after workspace transition work
- Micro-freezes and hesitation between sections
- Occasional full freezes (partially addressed earlier)

## Root causes found

### 1. `AnimatePresence mode="wait"` (fixed)

Each navigation ran **exit animation (~190ms) then enter (~240ms)** before the new page appeared. That is ~400ms+ of intentional delay per click, plus lazy-load time.

**Fix:** Removed Framer route transitions. Routes use **CSS enter-only** (160ms) with **immediate unmount** of the previous page (React `key` on outlet).

### 2. `mode="sync"` (fixed earlier)

Kept two full route trees mounted → duplicate API calls and intervals → browser freeze.

### 3. Duplicate background polling (fixed)

| Source | Behavior |
|--------|----------|
| `Layout.jsx` | `api.leads.list` + unread count every 30s |
| `CRMPreview/index.jsx` | Same `api.leads.list` every 30s on Dashboard |

**Fix:** Removed Dashboard interval; manual refresh via PipelineSummary only. Layout polls every 45s, skips when tab hidden, dedupes in-flight requests.

### 4. Framer Motion on in-page swaps (fixed)

`WorkspacePanel` / `WorkspaceSwap` used `AnimatePresence` + motion layers on top of route motion.

**Fix:** Plain React mounts (no presence). Lead detail and reply thread swap instantly.

### 5. Dashboard `ParticleCanvas` (mitigated)

Continuous `requestAnimationFrame` loop while Dashboard is open.

**Fix:** Skip drawing when `document.hidden` (tab in background).

### 6. Route Finder background refresh (mitigated)

`visibilitychange` could trigger heavy `backgroundRefresh` immediately.

**Fix:** 800ms debounce on visibility-triggered refresh.

### 7. Lazy route chunks (mitigated)

First visit to a section downloads JS chunk → Suspense fallback.

**Fix:** `prefetchRoute()` on sidebar hover/focus warms chunks.

## Verification checklist

- [x] Only one route tree mounted (no AnimatePresence on outlet)
- [x] No exit-animation blocking on navigation
- [x] Layout interval cleared on unmount
- [x] Dashboard duplicate interval removed
- [x] Route Finder interval cleared on unmount

## Profiling recommendations (manual)

1. **Chrome Performance** — Record while clicking sidebar 10×; confirm no long tasks > 50ms after fix.
2. **Network** — One `leads` request per navigation to Leads (not double from Layout + page at same instant).
3. **React Profiler** — Route change should show unmount previous page, mount new (not two pages).

## What we intentionally did not add

- More animations or blur effects
- Heavier transition libraries on the critical path
