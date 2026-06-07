import { describe, it, expect } from 'vitest';
import {
  ROUTE_FINDER_SERVICE_CARDS,
  resolveServiceCardSelection,
  buildRouteFinderLead,
  isServiceCardId,
} from './routeServiceTypes.js';

const BASE_LEAD = {
  lat: 43.21,
  lng: -71.54,
  address: '123 Main St, Concord, NH',
  timeWindowPreference: 'AM',
  routeArea: 'new_hampshire',
  date: '2026-06-09',
};

describe('Route Finder service cards', () => {
  it('defines five sales-rep service cards', () => {
    expect(ROUTE_FINDER_SERVICE_CARDS).toHaveLength(5);
    expect(ROUTE_FINDER_SERVICE_CARDS.map(c => c.code)).toEqual(['IT', 'IQ', 'T/M', 'BB', 'COM']);
  });

  it('selecting IT sets 60 minutes', () => {
    const r = resolveServiceCardSelection('it');
    expect(r.valid).toBe(true);
    expect(r.durationMinutes).toBe(60);
    expect(r.durationSource).toBe('service-card');
    expect(r.serviceLabel).toBe('IT / Insect Triannual');
  });

  it('selecting IQ sets 60 minutes', () => {
    const r = resolveServiceCardSelection('iq');
    expect(r.valid).toBe(true);
    expect(r.durationMinutes).toBe(60);
    expect(r.serviceLabel).toBe('IQ / Insect Quarterly');
  });

  it('selecting Tick & Mosquito sets 30 minutes', () => {
    const r = resolveServiceCardSelection('tick-mosquito');
    expect(r.valid).toBe(true);
    expect(r.durationMinutes).toBe(30);
  });

  it('selecting Bed Bugs sets 60 minutes', () => {
    const r = resolveServiceCardSelection('bed-bugs');
    expect(r.valid).toBe(true);
    expect(r.durationMinutes).toBe(60);
  });

  it('selecting Commercial defaults to 60 minutes', () => {
    const r = resolveServiceCardSelection('commercial', 60);
    expect(r.valid).toBe(true);
    expect(r.durationMinutes).toBe(60);
    expect(r.durationSource).toBe('service-card-commercial');
    expect(r.durationConfidence).toBe('selected');
  });

  it('Commercial 90 and 120 update duration', () => {
    expect(resolveServiceCardSelection('commercial', 90).durationMinutes).toBe(90);
    expect(resolveServiceCardSelection('commercial', 120).durationMinutes).toBe(120);
  });

  it('buildRouteFinderLead passes selected card duration to scoring lead', () => {
    const built = buildRouteFinderLead({
      ...BASE_LEAD,
      serviceTypeId: 'tick-mosquito',
      customerName: '',
      notes: '',
      callAheadRequired: false,
    });
    expect(built.valid).toBe(true);
    expect(built.lead.serviceTypeId).toBe('tick-mosquito');
    expect(built.lead.durationMinutes).toBe(30);
    expect(built.lead.durationSource).toBe('service-card');
    expect(built.lead.customerName).toBeNull();
    expect(built.lead.notes).toBeNull();
    expect(built.lead.callAheadRequired).toBe(false);
  });

  it('requires service card before scoring', () => {
    const built = buildRouteFinderLead({
      ...BASE_LEAD,
      serviceTypeId: '',
    });
    expect(built.valid).toBe(false);
    expect(built.errors).toContain('Select a service type before finding routes.');
  });

  it('recognizes service card ids', () => {
    expect(isServiceCardId('iq')).toBe(true);
    expect(isServiceCardId('rit-initial')).toBe(false);
  });
});
