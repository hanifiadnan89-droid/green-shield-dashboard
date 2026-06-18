import { describe, it, expect } from 'vitest';
import {
  buildMatchV2Profile,
  evaluateServiceAreaMatch,
  enrichScoringResultWithV2Profiles,
  reorderMatchesByEligibility,
  resolveProjectedStopCount,
} from '../technicianEligibility.js';
import { getTechnicianProfile } from '../technicianProfiles.js';

function makeMatch(overrides = {}) {
  return {
    techName: 'Chris Adams',
    routeId: 'R-ME01',
    stopCount: 5,
    scores: { total: 80 },
    ...overrides,
  };
}

function makeLead(overrides = {}) {
  return {
    routeArea: 'maine',
    serviceType: 'Regular Service',
    serviceAbbreviation: 'RIT',
    ...overrides,
  };
}

describe('technicianEligibility', () => {
  it('matches technician profile by exact name', () => {
    const profile = buildMatchV2Profile(makeMatch({ techName: 'Alex Gray' }), makeLead({
      routeArea: 'new_hampshire',
      serviceAbbreviation: 'IQ',
    }));

    expect(profile.matched).toBe(true);
    expect(profile.profileTechName).toBe('Alex Gray');
    expect(profile.eligibilityStatus).toBe('eligible');
    expect(profile.serviceCapabilityMatch).toBe(true);
    expect(profile.serviceAreaMatch).toBe(true);
  });

  it('matches technician profile by alias', () => {
    const profile = buildMatchV2Profile(makeMatch({ techName: 'C. Adams' }), makeLead());

    expect(profile.matched).toBe(true);
    expect(profile.profileTechName).toBe('Chris Adams');
  });

  it('warns when technician profile is missing', () => {
    const profile = buildMatchV2Profile(makeMatch({ techName: 'Alex Smith' }), makeLead());

    expect(profile.matched).toBe(false);
    expect(profile.profileTechName).toBeNull();
    expect(profile.eligibilityStatus).toBe('warning');
    expect(profile.warnings).toContain('Missing technician profile');
    expect(profile.profileFitScore).toBe(85);
  });

  it('warns when projected stops exceed preferred max', () => {
    const profile = buildMatchV2Profile(
      makeMatch({ techName: 'Alex Gray', stopCount: 12 }),
      makeLead({ routeArea: 'new_hampshire', serviceAbbreviation: 'IQ' }),
    );

    expect(profile.overPreferredMaxStops).toBe(true);
    expect(profile.overHardMaxStops).toBe(false);
    expect(profile.eligibilityStatus).toBe('warning');
    expect(profile.warnings).toContain('Route exceeds preferred stop limit');
    expect(profile.profileFitScore).toBe(92);
  });

  it('disqualifies when projected stops exceed hard max', () => {
    const profile = buildMatchV2Profile(
      makeMatch({ techName: 'Alex Gray', stopCount: 16 }),
      makeLead({ routeArea: 'new_hampshire', serviceAbbreviation: 'IQ' }),
    );

    expect(profile.overHardMaxStops).toBe(true);
    expect(profile.eligibilityStatus).toBe('disqualified');
    expect(profile.warnings).toContain('Route exceeds hard stop limit');
    expect(profile.profileFitScore).toBe(0);
  });

  it('marks service capability match for supported services', () => {
    const profile = buildMatchV2Profile(
      makeMatch({ techName: 'Chris Adams' }),
      makeLead({ serviceAbbreviation: 'BB', serviceLabel: 'Bed Bug Service' }),
    );

    expect(profile.serviceCapabilityMatch).toBe(true);
    expect(profile.eligibilityStatus).toBe('eligible');
  });

  it('disqualifies when service is in cannotDoServices', () => {
    const profile = buildMatchV2Profile(
      makeMatch({ techName: 'Alex Gray' }),
      makeLead({ serviceAbbreviation: 'BB', serviceLabel: 'Bed Bug Service' }),
    );

    expect(profile.serviceCapabilityMatch).toBe(false);
    expect(profile.eligibilityStatus).toBe('disqualified');
    expect(profile.warnings).toContain('Technician is not eligible for this service');
  });

  it('resolves projected stop count from technicians when stopCount is absent', () => {
    const technicians = [{ routeId: 'R-1', stops: [{}, {}, {}] }];
    expect(resolveProjectedStopCount({ routeId: 'R-1' }, technicians)).toBe(4);
  });

  it('evaluates service area match from profile regions', () => {
    const chris = getTechnicianProfile('Chris Adams');
    expect(evaluateServiceAreaMatch(chris, { routeArea: 'maine' })).toBe(true);
    expect(evaluateServiceAreaMatch(chris, { routeArea: 'new_hampshire' })).toBe(false);
  });

  it('reorders disqualified matches below eligible and warning candidates', () => {
    const matches = reorderMatchesByEligibility([
      {
        techName: 'High Score',
        scores: { total: 95 },
        v2Profile: { eligibilityStatus: 'disqualified' },
      },
      {
        techName: 'Mid Score',
        scores: { total: 80 },
        v2Profile: { eligibilityStatus: 'warning' },
      },
      {
        techName: 'Lower Score',
        scores: { total: 70 },
        v2Profile: { eligibilityStatus: 'eligible' },
      },
    ]);

    expect(matches.map(m => m.techName)).toEqual(['Lower Score', 'Mid Score', 'High Score']);
  });

  it('enriches scoring result with v2Profile and reorders top matches', () => {
    const result = enrichScoringResultWithV2Profiles(
      {
        topMatches: [
          makeMatch({
            techName: 'Alex Gray',
            routeId: 'R-NH-1',
            scores: { total: 90 },
          }),
          makeMatch({
            techName: 'Chris Adams',
            routeId: 'R-ME-1',
            scores: { total: 75 },
          }),
        ],
        allScores: [
          { techName: 'Alex Gray', routeId: 'R-NH-1', total: 90 },
          { techName: 'Chris Adams', routeId: 'R-ME-1', total: 75 },
        ],
      },
      makeLead({ serviceAbbreviation: 'BB', serviceLabel: 'Bed Bug Service' }),
      [],
    );

    expect(result.topMatches[0].techName).toBe('Chris Adams');
    expect(result.topMatches[0].v2Profile.eligibilityStatus).toBe('eligible');
    expect(result.topMatches[1].techName).toBe('Alex Gray');
    expect(result.topMatches[1].v2Profile.eligibilityStatus).toBe('disqualified');
    expect(result.allScores[0].v2Profile.eligibilityStatus).toBe('disqualified');
    expect(result.recommendation.techName).toBe('Chris Adams');
  });
});
