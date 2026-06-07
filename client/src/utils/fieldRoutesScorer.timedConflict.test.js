import { describe, it, expect } from 'vitest';
import { scoreRoutes } from './fieldRoutesScorer.js';
import { twoTimedAnchors } from './__tests__/fieldRoutesScorer.fixtures.js';

describe('fieldRoutesScorer timed appointment conflicts', () => {
  it('returns timed appointment detail on matches', () => {
    const { topMatches } = scoreRoutes(twoTimedAnchors.technicians, twoTimedAnchors.lead, 1);
    const ins = topMatches[0]?.bestInsertion;
    expect(ins).toBeTruthy();
    expect(ins.timedAppointmentDetail).toBeTruthy();
    expect(['none', 'safe', 'risk', 'conflict']).toContain(ins.timedAppointmentDetail.timedAppointmentStatus);
  });

  it('includes service abbreviations on route stops when serviceCode present', () => {
    const techs = [{
      ...twoTimedAnchors.technicians[0],
      stops: twoTimedAnchors.technicians[0].stops.map((s, i) => ({
        ...s,
        serviceCode: i === 1 ? 'IQ' : s.serviceCode,
      })),
    }];
    const lead = { ...twoTimedAnchors.lead, serviceAbbreviation: 'RIT' };
    const { topMatches } = scoreRoutes(techs, lead, 1);
    const stops = topMatches[0]?.routeStops ?? [];
    const newStop = stops.find(s => s.isNew);
    expect(newStop?.serviceAbbreviation).toBe('RIT');
    const iqStop = stops.find(s => s.customerName === 'Timed Anchor 1');
    expect(iqStop?.serviceAbbreviation).toBe('IQ');
  });

  it('penalizes routes with timed violations instead of dropping them entirely', () => {
    const lead = {
      ...twoTimedAnchors.lead,
      lat: 43.479,
      lng: -70.471,
      durationMinutes: 180,
      serviceAbbreviation: 'IQ',
    };
    const { topMatches } = scoreRoutes(twoTimedAnchors.technicians, lead, 1);
    expect(topMatches.length).toBeGreaterThan(0);
    const ins = topMatches[0].bestInsertion;
    if (ins.timedViolations?.length) {
      expect(['medium', 'high']).toContain(ins.timedRisk);
      expect(ins.timedAppointmentDetail.timedConflictWarning).toMatch(/Scheduling conflict|late/i);
    }
  });
});
