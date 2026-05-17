/**
 * Golden snapshot tests — lock current behavior of fieldRoutesScorer.js.
 *
 * Each fixture produces a full scoreRoutes() output that is snapshotted.
 * These snapshots are the behavioral contract. They will be intentionally
 * updated (with reviewer eyes on the diff) when Phase 3+ fixes change behavior.
 * Phases 1–2 (config extraction + seam) must keep every snapshot green.
 */
import { describe, it, expect } from 'vitest';
import { scoreRoutes } from '../fieldRoutesScorer.js';
import { ALL_FIXTURES } from './fieldRoutesScorer.fixtures.js';

// Strip homeProximity from snapshots — it's an internal field not consumed by
// the widget and its exact structure is noise for snapshot diffs.
function sanitize(result) {
  if (!result || typeof result !== 'object') return result;
  if (Array.isArray(result)) return result.map(sanitize);
  const out = {};
  for (const [k, v] of Object.entries(result)) {
    if (k === 'homeProximity') continue;
    out[k] = sanitize(v);
  }
  return out;
}

describe('Golden snapshots — scoreRoutes output', () => {
  for (const [name, fixture] of Object.entries(ALL_FIXTURES)) {
    it(`fixture: ${name}`, () => {
      const result = scoreRoutes(fixture.technicians, fixture.lead, 3);
      expect(sanitize(result)).toMatchSnapshot();
    });
  }
});
