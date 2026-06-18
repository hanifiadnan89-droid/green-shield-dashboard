import { describe, it, expect, beforeAll } from 'vitest';
import { getValidationExampleById } from '../validationExamples.js';
import { buildLeadFromValidationExample, evaluateValidationExample } from '../validationRunner.js';
import { scoreSingleDateV2 } from '../../routeFinderScoringV2.js';
import {
  CORRIDOR_DIAGNOSTIC_ROUTE_PAYLOADS,
} from '../testFixtures/corridorFailureDiagnostics.fixture.js';
import {
  buildTerritoryOwnershipModifiers,
  isPrimaryCorridorOwner,
  resolvePrimaryCorridorOwners,
} from '../territoryOwnership.js';
import { matchTechnicianProfile } from '../technicianProfiles.js';
import { buildMatchV2Profile } from '../technicianEligibility.js';
import { buildMatchV2Score } from '../profileScoringModifiers.js';

const CORRIDOR_ACCEPTANCE_CASES = [
  { id: 'old-orchard-tm-example-013', routeDate: '2026-06-04' },
  { id: 'scarborough-tm-example-017', routeDate: '2026-06-04' },
  { id: 'windham-general-example-024', routeDate: '2026-06-04' },
  { id: 'scarborough-iq-example-016', routeDate: '2026-06-04' },
  { id: 'scarborough-tm-example-017', routeDate: '2026-06-05' },
];

beforeAll(() => {
  process.env.VITE_ROUTE_FINDER_V2_SCORING = 'true';
});

describe('territoryOwnership safeguard', () => {
  it('maps primary corridor owners for diagnostic towns', () => {
    expect(resolvePrimaryCorridorOwners('Scarborough')).toEqual(['Paige Bullock']);
    expect(resolvePrimaryCorridorOwners('Old Orchard Beach')).toEqual(['Ian Pratt', 'Patrick Carney']);
    expect(resolvePrimaryCorridorOwners('Windham')).toEqual(['Chris McGary', 'Paige Bullock']);
    expect(isPrimaryCorridorOwner('Paige Bullock', 'Scarborough')).toBe(true);
    expect(isPrimaryCorridorOwner('Jack Johnson', 'Scarborough')).toBe(false);
  });

  it('applies neighboring territory penalty when a primary owner is available', () => {
    const lead = {
      address: '8 Black Point Rd, Scarborough, ME',
      town: 'Scarborough',
      routeArea: 'maine',
      serviceType: 'TICK_MOSQUITO',
    };
    const paigeMatch = {
      techName: 'Paige Bullock',
      routeId: 'R-PB',
      scores: { total: 74 },
      v2Profile: buildMatchV2Profile({ techName: 'Paige Bullock', routeId: 'R-PB', stopCount: 3, scores: { total: 74 } }, lead),
    };
    const jackMatch = {
      techName: 'Jack Johnson',
      routeId: 'R-JJ',
      scores: { total: 100 },
      routeStops: [{ address: '8 Black Point Rd, Scarborough, ME' }],
      v2Profile: buildMatchV2Profile({
        techName: 'Jack Johnson',
        routeId: 'R-JJ',
        stopCount: 3,
        scores: { total: 100 },
        routeStops: [{ address: '8 Black Point Rd, Scarborough, ME' }],
      }, lead),
    };

    const availableOwners = ['Paige Bullock'];
    const jackMods = buildTerritoryOwnershipModifiers(
      jackMatch,
      matchTechnicianProfile('Jack Johnson'),
      'Scarborough',
      availableOwners,
      true,
    );

    expect(jackMods.penalties.some(item => item.code === 'neighboring_territory_penalty')).toBe(true);
    expect(jackMods.bonuses.some(item => item.code === 'territory_owner_bonus')).toBe(false);

    const paigeMods = buildTerritoryOwnershipModifiers(
      paigeMatch,
      matchTechnicianProfile('Paige Bullock'),
      'Scarborough',
      availableOwners,
      false,
    );
    expect(paigeMods.bonuses.some(item => item.code === 'territory_owner_bonus')).toBe(true);
  });

  it('does not apply neighboring territory penalty without an available primary owner', () => {
    const mods = buildTerritoryOwnershipModifiers(
      { techName: 'Jack Johnson' },
      matchTechnicianProfile('Jack Johnson'),
      'Scarborough',
      [],
      true,
    );
    expect(mods.penalties.some(item => item.code === 'neighboring_territory_penalty')).toBe(false);
  });
});

describe('corridor failure acceptance (territory safeguard)', () => {
  for (const { id, routeDate } of CORRIDOR_ACCEPTANCE_CASES) {
    it(`${id} @ ${routeDate} ranks expected technician #1`, async () => {
      const example = getValidationExampleById(id);
      expect(example).toBeTruthy();

      const technicians = CORRIDOR_DIAGNOSTIC_ROUTE_PAYLOADS[routeDate].technicians;
      const lead = buildLeadFromValidationExample(example);
      const bundle = await scoreSingleDateV2(
        technicians,
        lead,
        technicians.length,
        { prefetchTravel: false },
      );

      const evaluation = evaluateValidationExample(example, technicians, bundle.result);
      expect(evaluation.passed).toBe(true);
      expect(evaluation.actualTopTechName).toBe(example.expectedTechName);

      const expectedMatch = bundle.result.topMatches.find(
        match => match.techName === example.expectedTechName,
      );
      expect(expectedMatch?.v2Score?.bonuses?.some(item => item.code === 'territory_owner_bonus')).toBe(true);
    });
  }
});
