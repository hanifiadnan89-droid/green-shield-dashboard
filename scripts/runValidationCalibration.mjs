#!/usr/bin/env node
/**
 * Route Finder V2 — run real-route calibration from repo root.
 *
 * Reads scraped route cache from data/routes/*.normalized.json.
 * Prefers 2026-06-18 when present; otherwise uses the latest cached date.
 *
 * Usage (from repo root):
 *   npm run validation:calibrate
 *   node scripts/runValidationCalibration.mjs
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CLIENT_DIR = resolve(ROOT_DIR, 'client');

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
    env: {
      ...process.env,
      VITE_ROUTE_FINDER_V2_SCORING: 'true',
    },
  },
);

process.exit(child.status ?? 1);
