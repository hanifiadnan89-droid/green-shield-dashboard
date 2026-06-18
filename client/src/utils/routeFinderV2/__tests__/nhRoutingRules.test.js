import { describe, it, expect } from 'vitest';
import {
  NH_APPROVED_TECHNICIAN_NAMES,
  NH_FORBIDDEN_TECHNICIAN_NAMES,
  evaluateLeadNhRoutingContext,
  evaluateNhRouteDayMatch,
  getV2ScorerConfigForLead,
  isNhApprovedTechnician,
  isNhForbiddenTechnician,
  resolveNhSubRegionForTown,
} from '../nhRoutingRules.js';
import { SCORER_CONFIG } from '../../fieldRoutesScorer.js';

describe('nhRoutingRules', () => {
  it('defines approved and forbidden NH technicians', () => {
    expect(NH_APPROVED_TECHNICIAN_NAMES).toEqual(['Jay Glaude', 'Alex Gray']);
    expect(NH_FORBIDDEN_TECHNICIAN_NAMES).toContain('Joshua Harrington');
    expect(NH_FORBIDDEN_TECHNICIAN_NAMES).toContain('Dmitri Rovinskinov');
    expect(isNhApprovedTechnician('Jay Glaude')).toBe(true);
    expect(isNhApprovedTechnician('Joshua Harrington')).toBe(false);
    expect(isNhForbiddenTechnician('Dmitri Rovinskinov')).toBe(true);
  });

  it('infers NH sub-regions from town', () => {
    expect(resolveNhSubRegionForTown('Derry')?.key).toBe('nh_monday_wednesday_friday');
    expect(resolveNhSubRegionForTown('Manchester')?.key).toBe('nh_monday_wednesday_friday');
    expect(resolveNhSubRegionForTown('North Hampton')?.key).toBe('nh_monday_wednesday_friday');
    expect(resolveNhSubRegionForTown('Portsmouth')?.key).toBe('nh_tuesday_thursday');
    expect(resolveNhSubRegionForTown('Dover')?.key).toBe('nh_tuesday_thursday');
    expect(resolveNhSubRegionForTown('Rochester')?.key).toBe('nh_tuesday_thursday');
    expect(resolveNhSubRegionForTown('Somersworth')?.key).toBe('nh_tuesday_thursday');
  });

  it('evaluates NH route day matches by sub-region', () => {
    const mwf = resolveNhSubRegionForTown('Derry');
    const tuth = resolveNhSubRegionForTown('Dover');

    expect(evaluateNhRouteDayMatch('2026-06-19', mwf).matches).toBe(true);
    expect(evaluateNhRouteDayMatch('2026-06-18', mwf).matches).toBe(false);
    expect(evaluateNhRouteDayMatch('2026-06-18', tuth).matches).toBe(true);
    expect(evaluateNhRouteDayMatch('2026-06-19', tuth).matches).toBe(false);
  });

  it('builds lead NH routing context with day warnings', () => {
    const mismatch = evaluateLeadNhRoutingContext({
      routeArea: 'new_hampshire',
      address: '10 Crystal Ave, Derry, NH',
      date: '2026-06-18',
    });

    expect(mismatch.nhSubRegion).toBe('nh_monday_wednesday_friday');
    expect(mismatch.nhRouteDayMatch).toBe(false);
    expect(mismatch.nhRouteDayWarning).toContain('Monday/Wednesday/Friday');

    const match = evaluateLeadNhRoutingContext({
      routeArea: 'new_hampshire',
      address: '100 Central Ave, Dover, NH',
      date: '2026-06-18',
    });

    expect(match.nhSubRegion).toBe('nh_tuesday_thursday');
    expect(match.nhRouteDayMatch).toBe(true);
  });

  it('returns V2-only NH scorer config with Jay and Alex', () => {
    const cfg = getV2ScorerConfigForLead({
      routeArea: 'new_hampshire',
      address: '100 Central Ave, Dover, NH',
    });

    expect(cfg?.nh.approvedTechNames).toEqual(['Jay Glaude', 'Alex Gray']);
    expect(SCORER_CONFIG.nh.approvedTechNames).toEqual(['Alex Gray']);
  });
});
