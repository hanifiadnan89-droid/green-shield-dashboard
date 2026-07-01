import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../client.js';

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_WINDOW = globalThis.window;

function fakeOkResponse(body = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async text() { return JSON.stringify(body); },
  };
}

describe('client adminDbAppendOnly api', () => {
  let fetchMock;

  beforeEach(() => {
    if (!globalThis.window) {
      globalThis.window = { addEventListener() {}, dispatchEvent() {}, removeEventListener() {} };
    }
    fetchMock = vi.fn().mockResolvedValue(fakeOkResponse({ validation: { status: 'pass', checks: [] } }));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_WINDOW === undefined) delete globalThis.window;
    else globalThis.window = ORIGINAL_WINDOW;
    vi.restoreAllMocks();
  });

  it('exposes only adminDbAppendOnly.validation — no mutate/migrate/backfill helpers', () => {
    expect(typeof api.adminDbAppendOnly.validation).toBe('function');
    // Defense-in-depth: this namespace must never gain action helpers.
    const keys = Object.keys(api.adminDbAppendOnly);
    expect(keys).toEqual(['validation']);
    for (const k of keys) {
      expect(k).not.toMatch(/enable|toggle|set|apply|migrate|backfill|reconcile|delete|reset|flag/i);
    }
  });

  it('validation() defaults to GET /api/admin/db/append-only/validation without refresh', async () => {
    await api.adminDbAppendOnly.validation();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/db/append-only/validation');
    expect(init?.method).toBeUndefined();
  });

  it('validation({ refresh: true }) hits the route with ?refresh=true', async () => {
    await api.adminDbAppendOnly.validation({ refresh: true });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/db/append-only/validation?refresh=true');
  });

  it('validation({ refresh: false }) drops the query string', async () => {
    await api.adminDbAppendOnly.validation({ refresh: false });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/db/append-only/validation');
  });

  it('validation() never sets a non-GET HTTP method', async () => {
    await api.adminDbAppendOnly.validation();
    await api.adminDbAppendOnly.validation({ refresh: true });
    for (const call of fetchMock.mock.calls) {
      const init = call[1];
      // The shared request() helper does not set method for GETs. If a future
      // refactor introduces one here, this test guards against accidental mutation.
      expect(init?.method).toBeUndefined();
    }
  });
});
