import { describe, it, expect } from 'vitest';
import {
  ROUTE_SERVICE_TYPES,
  CUSTOM_DURATION_ID,
  buildRouteFinderLead,
  resolveServiceDuration,
  getServiceTypeById,
} from './routeServiceTypes.js';

describe('routeServiceTypes', () => {
  it('defines all required service types with valid durations', () => {
    expect(ROUTE_SERVICE_TYPES.length).toBeGreaterThanOrEqual(15);
    for (const t of ROUTE_SERVICE_TYPES) {
      expect(t.id).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.defaultDurationMinutes).toBeGreaterThan(0);
      expect(['standard', 'estimated', 'custom']).toContain(t.durationConfidence);
    }
  });

  it('resolves IQ Recurring to 30 minutes', () => {
    const r = resolveServiceDuration('iq-recurring', null);
    expect(r.valid).toBe(true);
    expect(r.durationMinutes).toBe(30);
    expect(r.durationConfidence).toBe('standard');
  });

  it('validates custom duration bounds', () => {
    expect(resolveServiceDuration(CUSTOM_DURATION_ID, 5).valid).toBe(false);
    expect(resolveServiceDuration(CUSTOM_DURATION_ID, 300).valid).toBe(false);
    const ok = resolveServiceDuration(CUSTOM_DURATION_ID, 90);
    expect(ok.valid).toBe(true);
    expect(ok.durationMinutes).toBe(90);
    expect(ok.durationConfidence).toBe('custom');
  });

  it('buildRouteFinderLead uses selected duration instead of hardcoded 30', () => {
    const rit = getServiceTypeById('rit-initial');
    const built = buildRouteFinderLead({
      lat: 43.3,
      lng: -70.5,
      address: '123 Main, Wells, ME',
      serviceTypeId: rit.id,
      timeWindowPreference: 'AM',
      routeArea: 'maine',
      date: '2026-06-09',
    });
    expect(built.valid).toBe(true);
    expect(built.lead.durationMinutes).toBe(75);
    expect(built.lead.serviceLabel).toBe('RIT Initial');
    expect(built.lead.durationConfidence).toBe('estimated');
  });

  it('requires address and service type', () => {
    const missing = buildRouteFinderLead({
      lat: null,
      lng: null,
      address: '',
      serviceTypeId: '',
      timeWindowPreference: 'AM',
    });
    expect(missing.valid).toBe(false);
    expect(missing.errors.length).toBeGreaterThan(0);
  });
});
