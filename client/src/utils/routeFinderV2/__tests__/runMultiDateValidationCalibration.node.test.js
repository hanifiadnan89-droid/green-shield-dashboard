import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_REAL_ROUTE_PAYLOADS } from '../testFixtures/realRouteCalibration.fixture.js';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const ROUTES_DIR = resolve(ROOT_DIR, 'data/routes');
const TEST_DATE = '2026-06-17';
const CACHE_FILE = resolve(ROUTES_DIR, `${TEST_DATE}.normalized.json`);
const SCRIPT_PATH = resolve(ROOT_DIR, 'scripts/runMultiDateValidationCalibration.mjs');

describe('runMultiDateValidationCalibration Node runtime', () => {
  beforeAll(() => {
    mkdirSync(ROUTES_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(MOCK_REAL_ROUTE_PAYLOADS[TEST_DATE]));
  });

  afterAll(() => {
    if (existsSync(CACHE_FILE)) {
      rmSync(CACHE_FILE);
    }
  });

  it('runs multi-date calibration script without import.meta.env', () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT_PATH, TEST_DATE],
      {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          VITE_ROUTE_FINDER_V2_SCORING: 'true',
        },
        encoding: 'utf8',
      },
    );

    if (result.status !== 0) {
      // eslint-disable-next-line no-console
      console.error(result.stderr || result.stdout);
    }

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Multi-Date Calibration Summary');
  }, 300000);
});
