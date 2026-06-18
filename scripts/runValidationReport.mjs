#!/usr/bin/env node
/**
 * Route Finder V2 — run deterministic fixture validation baseline from repo root.
 *
 * Usage (from repo root):
 *   npm run validation:report
 *   node scripts/runValidationReport.mjs
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
    'src/utils/routeFinderV2/__tests__/runValidationReport.test.js',
    '-t',
    'full baseline validation report',
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
