# Route Finder — Road-Based Travel Time

Route Finder can use **Google Routes API** (server-side) for road-based drive time and distance. The browser map preview continues to use `VITE_GOOGLE_MAPS_API_KEY`.

## Required environment variable

| Variable | Where | Purpose |
|----------|-------|---------|
| `GOOGLE_ROUTES_API_KEY` | Render server env | Server-side Routes API matrix calls |
| `VITE_GOOGLE_MAPS_API_KEY` | Client build env | Maps JavaScript preview only |

## Google Cloud setup

1. Enable **Routes API** in Google Cloud Console.
2. Create a **separate server-side API key**.
3. Restrict the key to **Routes API** (IP or server restrictions as appropriate).
4. Add `GOOGLE_ROUTES_API_KEY` to Render — no client rebuild required.
5. Keep `VITE_GOOGLE_MAPS_API_KEY` restricted to your site referrers for map preview.

## Behavior without Routes API

If `GOOGLE_ROUTES_API_KEY` is missing or the API errors:

- Route Finder falls back to haversine + speed heuristics.
- UI shows **Estimated drive time** instead of road-based.
- Scoring, Single Date, and Best Available modes continue to work.

## API endpoints

- `GET /api/routes/travel-status` — whether the server key is configured.
- `POST /api/routes/travel-legs` — batch leg lookup with file cache (15–30 min route cache, 24h pair cache).

## Diagnostics

Scoring responses include per-match `travelProvider` and `travelAccuracy`. Server diagnostics include `matrixProvider`, `cacheHit`, `elementsRequested`, and `fallbackUsed`.
