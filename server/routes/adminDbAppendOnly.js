// Admin-only read-only readiness endpoint for the append-only Postgres
// enablement validator (AI usage + Error Center logs).
//
// Strict non-goals:
//   - never enables DB_WRITE_* or DB_READ_* feature flags
//   - never applies migrations
//   - never runs backfill or reconciliation
//   - never writes a report file to disk (use the CLI for that)
//   - never mutates any state
//   - never exposes DATABASE_URL credentials, secrets, or raw logs

import express from 'express';
import { requireAdmin } from '../security/internalAccess.js';
import { validateAppendOnlyDbEnablement } from '../repositories/backfill/appendOnlyDbEnablementValidation.js';

const CACHE_TTL_SECONDS = 30;
const CACHE_KEY = 'append-only-validation';

let cacheEntry = null;

function nowMs() {
  return Date.now();
}

function readCachedValidation() {
  if (!cacheEntry) return null;
  if (nowMs() - cacheEntry.cachedAtMs > CACHE_TTL_SECONDS * 1000) {
    cacheEntry = null;
    return null;
  }
  return cacheEntry;
}

function storeCachedValidation(validation) {
  cacheEntry = {
    key: CACHE_KEY,
    validation,
    cachedAt: new Date().toISOString(),
    cachedAtMs: nowMs(),
  };
  return cacheEntry;
}

export function resetAdminDbAppendOnlyCacheForTests() {
  cacheEntry = null;
}

function parseRefresh(req) {
  const value = req?.query?.refresh;
  if (value === true) return true;
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

const router = express.Router();

router.get(
  '/append-only/validation',
  requireAdmin,
  async (req, res) => {
    try {
      const refresh = parseRefresh(req);
      let cached = null;
      let cacheHit = false;

      if (!refresh) {
        cached = readCachedValidation();
        if (cached) cacheHit = true;
      }

      let validation = cached?.validation || null;
      let cachedAt = cached?.cachedAt || null;

      if (!validation) {
        validation = await validateAppendOnlyDbEnablement();
        const stored = storeCachedValidation(validation);
        cachedAt = stored.cachedAt;
      }

      return res.json({
        source: 'append_only_db_enablement_validation',
        generatedAt: new Date().toISOString(),
        cache: {
          cached: cacheHit,
          cacheTtlSeconds: CACHE_TTL_SECONDS,
          cachedAt: cachedAt || null,
        },
        validation,
      });
    } catch (err) {
      console.error('[admin/db/append-only/validation]', err?.message || err);
      return res.status(500).json({
        error: 'Failed to read append-only DB validation.',
        code: 'APPEND_ONLY_VALIDATION_READ_FAILED',
      });
    }
  },
);

export default router;
