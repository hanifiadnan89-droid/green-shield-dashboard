#!/usr/bin/env node
/**
 * Route Finder V2 — run real-route calibration from repo root.
 *
 * Route date selection (first match wins):
 *   1. ROUTE_DATE=YYYY-MM-DD environment variable
 *   2. npm run validation:calibrate -- --routeDate=YYYY-MM-DD
 *   3. Auto-pick 2026-06-18 when cached, else latest *.normalized.json
 *
 * Usage (from repo root):
 *   npm run validation:calibrate
 *   ROUTE_DATE=2026-06-05 npm run validation:calibrate
 *   npm run validation:calibrate -- --routeDate=2026-06-05
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCalibrationRouteDateFromArgv } from '../client/src/utils/routeFinderV2/realRouteCalibrationSource.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CLIENT_DIR = resolve(ROOT_DIR, 'client');

const routeDateArg = parseCalibrationRouteDateFromArgv(process.argv.slice(2));

const env = {
  ...process.env,
  VITE_ROUTE_FINDER_V2_SCORING: 'true',
};

if (routeDateArg) {
  env.ROUTE_DATE = routeDateArg;
}

const child = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    'vitest',
    'run',
    'src/utils/routeFinderV2/__tests__/runValidationCalibrationReport.test.js',
    '-t',
    'real cached route calibration',
  ],
  {
    cwd: CLIENT_DIR,
    stdio: 'inherit',
    env,
  },
);

process.exit(child.status ?? 1);
