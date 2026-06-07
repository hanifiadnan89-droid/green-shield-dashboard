import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'data', 'routes');
const META_PATH = path.join(ROUTES_DIR, 'cache-meta.json');

function normPath(date) {
  return path.join(ROUTES_DIR, `${date}.normalized.json`);
}

describe('fieldRoutesPreloader reconcile', () => {
  let mod;

  beforeEach(async () => {
    await fs.promises.mkdir(ROUTES_DIR, { recursive: true });
    mod = await import('../fieldRoutesPreloader.js');
  });

  afterEach(async () => {
    try {
      const files = await fs.promises.readdir(ROUTES_DIR);
      await Promise.all(files.map(f => fs.promises.unlink(path.join(ROUTES_DIR, f))));
    } catch {
      // ignore
    }
  });

  it('downgrades ghost cached meta when normalized file is missing', async () => {
    const [date] = mod.getNextSixWorkingDays();
    const ghostTimestamp = new Date().toISOString();
    await fs.promises.writeFile(
      META_PATH,
      JSON.stringify({
        [date]: {
          status: 'cached',
          timestamp: ghostTimestamp,
          techCount: 4,
          stopCount: 12,
        },
      }),
    );

    const status = await mod.getStatus();
    expect(status[date].status).toBe('missing');

    const repairedMeta = JSON.parse(await fs.promises.readFile(META_PATH, 'utf8'));
    expect(repairedMeta[date].status).toBe('missing');
  });

  it('reports cached when normalized file exists even if meta is missing', async () => {
    const [date] = mod.getNextSixWorkingDays();
    await fs.promises.writeFile(normPath(date), JSON.stringify({ technicians: [] }));

    const status = await mod.getStatus();
    expect(status[date].status).toBe('cached');
    expect(status[date].timestamp).toBeTruthy();
  });

  it('marks stale refreshing as failed when file never appears', async () => {
    const [date] = mod.getNextSixWorkingDays();
    const staleStart = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    await fs.promises.writeFile(
      META_PATH,
      JSON.stringify({
        [date]: { status: 'refreshing', timestamp: staleStart },
      }),
    );

    const status = await mod.getStatus();
    expect(status[date].status).toBe('failed');
    expect(status[date].error).toMatch(/timed out/i);
  });

  it('treats ghost cached dates as stale for preload', async () => {
    const [date] = mod.getNextSixWorkingDays();
    await fs.promises.writeFile(
      META_PATH,
      JSON.stringify({
        [date]: {
          status: 'cached',
          timestamp: new Date().toISOString(),
        },
      }),
    );

    expect(await mod.isDateCacheStale(date)).toBe(true);
  });
});
