/**
 * Serialize FieldRoutes Playwright work so only one browser session runs at a time.
 * Prevents Render OOM / event-loop stalls that surface as HTTP 502 on unrelated routes.
 */

let _chain = Promise.resolve();
let _inFlight = false;

export function isFieldRoutesScrapeInFlight() {
  return _inFlight;
}

export function withFieldRoutesScrapeLock(label, fn) {
  const run = async () => {
    _inFlight = true;
    try {
      return await fn();
    } finally {
      _inFlight = false;
    }
  };

  const task = _chain.then(run, run);
  _chain = task.catch((err) => {
    console.warn(`[scrape-lock] ${label} failed:`, err?.message || err);
  });
  return task;
}
