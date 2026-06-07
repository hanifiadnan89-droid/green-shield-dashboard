import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildRouteFinderSearchFingerprint } from './routeFinderSearchFingerprint.js';

const WIDGET_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../RouteFinderWidget.jsx'),
  'utf8',
);

describe('RouteFinderWidget single-date mode', () => {
  it('does not render Search Mode UI', () => {
    expect(WIDGET_SOURCE).not.toContain('Search Mode');
    expect(WIDGET_SOURCE).not.toContain('Best Available');
    expect(WIDGET_SOURCE).not.toContain('Single Date');
    expect(WIDGET_SOURCE).not.toContain('scoreBestAvailable');
    expect(WIDGET_SOURCE).not.toContain('scoringMode');
  });

  it('fingerprints include activeDate for selected-date scoring', () => {
    const a = buildRouteFinderSearchFingerprint({
      geocode: { lat: 43.66, lng: -70.25 },
      timeWindowPreference: 'AM',
      serviceTypeId: 'it',
      commercialDurationMinutes: 60,
      activeDate: '2026-06-09',
    });
    const b = buildRouteFinderSearchFingerprint({
      geocode: { lat: 43.66, lng: -70.25 },
      timeWindowPreference: 'AM',
      serviceTypeId: 'it',
      commercialDurationMinutes: 60,
      activeDate: '2026-06-10',
    });
    expect(a).not.toBe(b);
  });
});
