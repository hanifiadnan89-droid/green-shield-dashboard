import { describe, it, expect } from 'vitest';
import { inferAppointmentDurationMinutes } from './routeServiceDurationRules.js';

describe('inferAppointmentDurationMinutes', () => {
  it('uses FieldRoutes duration when present', () => {
    const r = inferAppointmentDurationMinutes({ durationMinutes: 45, serviceType: 'Regular Service' });
    expect(r.durationMinutes).toBe(45);
    expect(r.confidence).toBe('exact');
  });

  it('infers initial service as 60 minutes', () => {
    expect(inferAppointmentDurationMinutes({ serviceType: 'Initial Service' }).durationMinutes).toBe(60);
    expect(inferAppointmentDurationMinutes({ serviceType: 'Subscription Initial' }).durationMinutes).toBe(60);
  });

  it('infers IQ recurring as 30 minutes', () => {
    expect(inferAppointmentDurationMinutes({ serviceType: 'Insect Quarterly Service' }).durationMinutes).toBe(30);
    expect(inferAppointmentDurationMinutes({ serviceCode: 'IQ', serviceType: 'Regular Service' }).durationMinutes).toBe(30);
  });

  it('infers re-service and T/M as 30 minutes', () => {
    expect(inferAppointmentDurationMinutes({ serviceType: 'Re-service' }).durationMinutes).toBe(30);
    expect(inferAppointmentDurationMinutes({ serviceType: 'Tick and Mosquito' }).durationMinutes).toBe(30);
  });

  it('infers bed bug as 60 minutes', () => {
    expect(inferAppointmentDurationMinutes({ serviceType: 'Bed Bug Treatment' }).durationMinutes).toBe(60);
  });

  it('uses fallback 30 with warning when unknown', () => {
    const r = inferAppointmentDurationMinutes({ serviceType: 'Mystery Visit' });
    expect(r.durationMinutes).toBe(30);
    expect(r.confidence).toBe('fallback');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('distinguishes RIT initial vs recurring', () => {
    expect(inferAppointmentDurationMinutes({ serviceType: 'RIT Initial' }).durationMinutes).toBe(60);
    const recurring = inferAppointmentDurationMinutes({ serviceType: 'Rodent Triannual' });
    expect(recurring.durationMinutes).toBe(30);
    expect(recurring.warnings.length).toBeGreaterThan(0);
  });
});
