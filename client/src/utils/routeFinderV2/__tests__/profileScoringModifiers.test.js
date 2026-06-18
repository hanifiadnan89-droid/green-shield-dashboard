import { describe, it, expect, vi } from 'vitest';
import * as technicianProfiles from '../technicianProfiles.js';
import { getTechnicianProfile } from '../technicianProfiles.js';
import { buildMatchV2Profile } from '../technicianEligibility.js';
import {
  buildMatchV2Score,
  enrichScoringResultWithV2Scores,
  isLeadInNormalServiceAreas,
  isStrongGeoCluster,
  isWeakGeoCluster,
  reorderMatchesByV2Score,
  resolveLeadTown,
} from '../profileScoringModifiers.js';

function makeLead(overrides = {}) {
  return {
    routeArea: 'maine',
    serviceType: 'Regular Service',
    serviceAbbreviation: 'IQ',
    town: 'Wells',
    ...overrides,
  };
}

function makeMatch(overrides = {}) {
  return {
    techName: 'Joseph Willey',
    routeId: 'R-ME01',
    stopCount: 5,
    scores: { total: 80 },
    clusterLabel: 'Strong cluster — 4 stops within 5 mi',
    areaViability: { areaViability: 'strong' },
    bestInsertion: { backtrackingRisk: 'None' },
    routeStops: [
      { address: 'Acme Pest Wells, Wells, ME' },
      { address: 'Evans Cottage Kennebunk, Kennebunk, ME' },
    ],
    ...overrides,
  };
}

function withProfile(match, lead, technicians = []) {
  return {
    ...match,
    v2Profile: buildMatchV2Profile(match, lead, { technicians }),
  };
}

describe('profileScoringModifiers', () => {
  it('builds v2Score with required shape and baseTotal equal to scores.total', () => {
    const lead = makeLead();
    const match = withProfile(makeMatch(), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(v2Score.baseTotal).toBe(80);
    expect(v2Score.adjustedTotal).toBe(v2Score.baseTotal + v2Score.adjustment);
    expect(v2Score.adjustment).toBe(
      v2Score.bonuses.reduce((sum, item) => sum + item.points, 0)
      - v2Score.penalties.reduce((sum, item) => sum + item.points, 0),
    );
    expect(Array.isArray(v2Score.penalties)).toBe(true);
    expect(Array.isArray(v2Score.bonuses)).toBe(true);
    expect(typeof v2Score.explanation).toBe('string');
    expect(match.scores.total).toBe(80);
  });

  it('applies missing technician profile penalty', () => {
    const lead = makeLead();
    const match = withProfile(makeMatch({
      techName: 'Alex Smith',
      clusterLabel: 'No stops within 5 mi',
      areaViability: { areaViability: 'acceptable' },
    }), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(v2Score.penalties.some(item => item.code === 'missing_technician_profile')).toBe(true);
    expect(v2Score.adjustment).toBeLessThan(0);
    expect(v2Score.adjustedTotal).toBe(v2Score.baseTotal + v2Score.adjustment);
  });

  it('applies over preferred max stops penalty', () => {
    const lead = makeLead({ routeArea: 'new_hampshire' });
    const match = withProfile(makeMatch({ techName: 'Alex Gray', stopCount: 13 }), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(v2Score.penalties.some(item => item.code === 'over_preferred_max_stops')).toBe(true);
  });

  it('applies large penalty for over hard max stops', () => {
    const lead = makeLead({ routeArea: 'new_hampshire' });
    const match = withProfile(makeMatch({
      techName: 'Alex Gray',
      stopCount: 18,
      clusterLabel: 'No stops within 5 mi',
      areaViability: { areaViability: 'acceptable' },
      routeStops: [],
    }), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(v2Score.penalties.some(item => item.code === 'over_hard_max_stops')).toBe(true);
    expect(v2Score.adjustedTotal).toBeLessThan(v2Score.baseTotal - 50);
  });

  it('applies large penalty for service-ineligible technicians', () => {
    vi.spyOn(technicianProfiles, 'matchTechnicianProfile').mockReturnValue({
      ...getTechnicianProfile('Joseph Willey'),
      cannotDoServices: ['BED_BUG'],
      canDoServices: getTechnicianProfile('Joseph Willey').canDoServices.filter(s => s !== 'BED_BUG'),
    });

    const lead = makeLead({ serviceAbbreviation: 'BB', serviceLabel: 'Bed Bug Service' });
    const match = withProfile(makeMatch({
      clusterLabel: 'No stops within 5 mi',
      areaViability: { areaViability: 'acceptable' },
      routeStops: [],
    }), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(v2Score.penalties.some(item => item.code === 'service_not_eligible')).toBe(true);
    expect(v2Score.adjustedTotal).toBeLessThan(v2Score.baseTotal - 50);

    vi.restoreAllMocks();
  });

  it('applies normal service area bonus when lead town is in profile areas', () => {
    const lead = makeLead({ town: 'Wells' });
    const match = withProfile(makeMatch(), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(isLeadInNormalServiceAreas(getTechnicianProfile('Joseph Willey'), 'Wells')).toBe(true);
    expect(v2Score.bonuses.some(item => item.code === 'normal_service_area_match')).toBe(true);
  });

  it('applies same-region bonus when route stop shares region with lead', () => {
    const lead = makeLead({ town: 'Scarborough' });
    const match = withProfile(makeMatch({
      routeStops: [{ address: 'Portland Home, Portland, ME' }],
    }), lead);
    const v2Score = buildMatchV2Score(match, lead);

    expect(v2Score.bonuses.some(item => item.code === 'same_region_match')).toBe(true);
  });

  it('applies strong geo cluster bonus', () => {
    const lead = makeLead();
    const match = withProfile(makeMatch({
      clusterLabel: 'Strong cluster — 4 stops within 5 mi',
      areaViability: { areaViability: 'strong' },
    }), lead);

    expect(isStrongGeoCluster(match)).toBe(true);
    const v2Score = buildMatchV2Score(match, lead);
    expect(v2Score.bonuses.some(item => item.code === 'strong_geo_cluster')).toBe(true);
  });

  it('applies weak/out-of-area geo cluster penalty', () => {
    const lead = makeLead();
    const match = withProfile(makeMatch({
      clusterLabel: 'No stops within 5 mi',
      areaViability: { areaViability: 'out_of_area' },
    }), lead);

    expect(isWeakGeoCluster(match)).toBe(true);
    const v2Score = buildMatchV2Score(match, lead);
    expect(v2Score.penalties.some(item => item.code === 'weak_geo_cluster')).toBe(true);
  });

  it('moves disqualified candidates below eligible and warning candidates', () => {
    const maineLead = makeLead({ routeArea: 'maine', town: 'Wells' });
    const nhLead = makeLead({ routeArea: 'new_hampshire', town: 'Exeter' });

    const joseph = withProfile(makeMatch({
      techName: 'Joseph Willey',
      routeId: 'R-ME-1',
      scores: { total: 70 },
    }), maineLead);

    const alex = withProfile(makeMatch({
      techName: 'Alex Gray',
      routeId: 'R-NH-1',
      stopCount: 13,
      scores: { total: 80 },
      routeStops: [{ address: 'Seacoast Home, Exeter, NH' }],
    }), nhLead);

    const matthew = withProfile(makeMatch({
      techName: 'Matthew Lavigne',
      routeId: 'R-W-1',
      stopCount: 18,
      scores: { total: 95 },
    }), maineLead);

    const matches = reorderMatchesByV2Score([matthew, alex, joseph].map(match => ({
      ...match,
      v2Score: buildMatchV2Score(match, match === alex ? nhLead : maineLead),
    })));

    expect(matches[0].v2Profile.eligibilityStatus).toBe('eligible');
    expect(matches[1].v2Profile.eligibilityStatus).toBe('warning');
    expect(matches[matches.length - 1].v2Profile.eligibilityStatus).toBe('disqualified');
    expect(matches.map(m => m.techName)).toEqual(['Joseph Willey', 'Alex Gray', 'Matthew Lavigne']);
  });

  it('enriches scoring result with v2Score and reorders top matches', () => {
    const lead = makeLead({ routeArea: 'new_hampshire', serviceAbbreviation: 'IQ' });
    const result = enrichScoringResultWithV2Scores(
      {
        topMatches: [
          makeMatch({
            techName: 'Matthew Lavigne',
            routeId: 'R-W-1',
            stopCount: 18,
            scores: { total: 90 },
            v2Profile: buildMatchV2Profile(
              makeMatch({ techName: 'Matthew Lavigne', routeId: 'R-W-1', stopCount: 18, scores: { total: 90 } }),
              lead,
            ),
          }),
          makeMatch({
            techName: 'Joseph Willey',
            routeId: 'R-ME-1',
            scores: { total: 75 },
            v2Profile: buildMatchV2Profile(
              makeMatch({ techName: 'Joseph Willey', routeId: 'R-ME-1', scores: { total: 75 } }),
              lead,
            ),
          }),
        ],
        allScores: [],
      },
      lead,
      [],
    );

    expect(result.topMatches[0].v2Score).toBeDefined();
    expect(result.topMatches[0].techName).toBe('Joseph Willey');
    expect(result.topMatches[0].scores.total).toBe(75);
    expect(result.recommendation.techName).toBe('Joseph Willey');
  });

  it('resolves lead town from address when town is absent', () => {
    expect(resolveLeadTown({ address: '123 Main St, Wells, ME' })).toBe('Wells');
  });
});
