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

describe('client aiObservability api', () => {
  let fetchMock;

  beforeEach(() => {
    if (!globalThis.window) {
      globalThis.window = { addEventListener() {}, dispatchEvent() {}, removeEventListener() {} };
    }
    fetchMock = vi.fn().mockResolvedValue(fakeOkResponse({}));
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_WINDOW === undefined) delete globalThis.window;
    else globalThis.window = ORIGINAL_WINDOW;
    vi.restoreAllMocks();
  });

  it('exposes aiObservability health, usage, and storage methods', () => {
    expect(typeof api.aiObservability.health).toBe('function');
    expect(typeof api.aiObservability.usage).toBe('function');
    expect(typeof api.aiObservability.storage).toBe('function');
  });

  it('storage() calls GET /api/ai/usage/storage', async () => {
    await api.aiObservability.storage();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/usage/storage');
    expect(init?.method).toBeUndefined();
  });

  it('health() calls GET /api/ai/health', async () => {
    await api.aiObservability.health();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/health');
    expect(init?.method).toBeUndefined();
  });

  it('usage() with no filters calls /api/ai/usage', async () => {
    await api.aiObservability.usage();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/usage');
  });

  it('usage() forwards feature, provider, limit, success=true, from, to', async () => {
    await api.aiObservability.usage({
      feature: 'embeddings',
      provider: 'openai',
      limit: 25,
      success: true,
      from: '2026-06-01',
      to: '2026-06-30',
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url.startsWith('/api/ai/usage?')).toBe(true);
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('feature')).toBe('embeddings');
    expect(params.get('provider')).toBe('openai');
    expect(params.get('limit')).toBe('25');
    expect(params.get('success')).toBe('true');
    expect(params.get('from')).toBe('2026-06-01');
    expect(params.get('to')).toBe('2026-06-30');
  });

  it('usage() forwards success=false and accepts string booleans', async () => {
    await api.aiObservability.usage({ success: false });
    let [url] = fetchMock.mock.calls[0];
    expect(new URL(url, 'http://localhost').searchParams.get('success')).toBe('false');

    fetchMock.mockClear();
    await api.aiObservability.usage({ success: 'true' });
    [url] = fetchMock.mock.calls[0];
    expect(new URL(url, 'http://localhost').searchParams.get('success')).toBe('true');
  });

  it('usage() drops empty filter values', async () => {
    await api.aiObservability.usage({ feature: '', provider: '', limit: null });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/usage');
  });
});
