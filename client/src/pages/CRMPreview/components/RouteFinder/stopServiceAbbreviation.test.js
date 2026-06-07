import { describe, it, expect } from 'vitest';
import {
  getStopServiceAbbreviation,
  getLeadServiceAbbreviation,
  formatStopCustomerDisplayName,
} from './stopServiceAbbreviation.js';

describe('getStopServiceAbbreviation', () => {
  it('prefers exact serviceCode when known', () => {
    expect(getStopServiceAbbreviation({ serviceCode: 'IQ' })).toBe('IQ');
    expect(getStopServiceAbbreviation({ serviceCode: 'RIT' })).toBe('RIT');
  });

  it('maps common service descriptions', () => {
    expect(getStopServiceAbbreviation({ serviceDescription: 'Re-service' })).toBe('RS');
    expect(getStopServiceAbbreviation({ serviceDescription: 'Reservice' })).toBe('RS');
    expect(getStopServiceAbbreviation({ serviceType: 'Insect Quarterly' })).toBe('IQ');
    expect(getStopServiceAbbreviation({ serviceType: 'Rodent Insect Triannual' })).toBe('RIT');
    expect(getStopServiceAbbreviation({ serviceDescription: 'Initial Service' })).toBe('IS');
    expect(getStopServiceAbbreviation({ serviceType: 'Tick and Mosquito' })).toBe('T/M');
    expect(getStopServiceAbbreviation({ serviceCode: 'BB' })).toBe('BB');
    expect(getStopServiceAbbreviation({ serviceType: 'Commercial Service' })).toBe('COM');
  });

  it('returns null for unclear services', () => {
    expect(getStopServiceAbbreviation({ serviceType: 'Mystery visit' })).toBeNull();
    expect(getStopServiceAbbreviation({})).toBeNull();
  });
});

describe('getLeadServiceAbbreviation', () => {
  it('uses lead serviceAbbreviation from service card', () => {
    expect(getLeadServiceAbbreviation({ serviceAbbreviation: 'RIT' })).toBe('RIT');
  });
});

describe('formatStopCustomerDisplayName', () => {
  it('includes abbreviation and NEW prefix', () => {
    expect(formatStopCustomerDisplayName({
      customerName: 'John Watson',
      serviceAbbreviation: 'IQ',
    })).toBe('John Watson (IQ)');

    expect(formatStopCustomerDisplayName({
      customerName: 'New customer',
      serviceAbbreviation: 'RIT',
      isNew: true,
    })).toBe('NEW · New customer (RIT)');
  });
});
