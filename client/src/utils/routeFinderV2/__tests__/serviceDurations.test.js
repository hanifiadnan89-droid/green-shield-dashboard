import { describe, it, expect } from 'vitest';
import {
  SERVICE_DURATION_RULES,
  getServiceDuration,
  getServiceBuffer,
  resolveLeadServiceTypeKey,
  resolveServiceDurationFromLead,
} from '../serviceDurations.js';

const REQUIRED_SERVICE_TYPES = [
  'RIT',
  'IQ',
  'TICK_MOSQUITO',
  'BED_BUG',
  'COMMERCIAL',
  'RESERVICE',
  'FOLLOW_UP',
  'GENERAL',
];

describe('serviceDurations', () => {
  it('defines all required service types', () => {
    const types = SERVICE_DURATION_RULES.map(rule => rule.serviceType);
    expect(types).toEqual(expect.arrayContaining(REQUIRED_SERVICE_TYPES));
    expect(types).toHaveLength(REQUIRED_SERVICE_TYPES.length);
  });

  it('getServiceDuration returns rule for known types', () => {
    const rit = getServiceDuration('RIT');
    expect(rit.serviceType).toBe('RIT');
    expect(rit.defaultMinutes).toBe(60);
    expect(rit.bufferMinutes).toBe(10);
  });

  it('getServiceDuration falls back to GENERAL for unknown types', () => {
    const fallback = getServiceDuration('UNKNOWN_TYPE');
    expect(fallback.serviceType).toBe('GENERAL');
    expect(fallback.defaultMinutes).toBe(30);
  });

  it('getServiceBuffer returns buffer from resolved rule', () => {
    expect(getServiceBuffer('IQ')).toBe(10);
    expect(getServiceBuffer('bogus')).toBe(5);
  });

  it('resolveLeadServiceTypeKey maps lead fields', () => {
    expect(resolveLeadServiceTypeKey({ serviceAbbreviation: 'RIT' })).toBe('RIT');
    expect(resolveLeadServiceTypeKey({ serviceTypeId: 'tick-mosquito' })).toBe('TICK_MOSQUITO');
    expect(resolveLeadServiceTypeKey({ isCommercial: true })).toBe('COMMERCIAL');
    expect(resolveLeadServiceTypeKey({ isReservice: true })).toBe('RESERVICE');
    expect(resolveLeadServiceTypeKey(null)).toBe('GENERAL');
  });

  it('resolveServiceDurationFromLead uses lead duration when provided', () => {
    const resolved = resolveServiceDurationFromLead({
      serviceAbbreviation: 'IQ',
      durationMinutes: 50,
    });
    expect(resolved.serviceType).toBe('IQ');
    expect(resolved.durationMinutes).toBe(50);
    expect(resolved.bufferMinutes).toBe(10);
  });

  it('resolveServiceDurationFromLead falls back to catalog defaults', () => {
    const resolved = resolveServiceDurationFromLead({
      serviceType: 'Mystery Service',
    });
    expect(resolved.serviceType).toBe('GENERAL');
    expect(resolved.durationMinutes).toBe(30);
    expect(resolved.bufferMinutes).toBe(5);
  });
});
