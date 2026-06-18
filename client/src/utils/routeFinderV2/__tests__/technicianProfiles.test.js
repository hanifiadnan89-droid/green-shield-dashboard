import { describe, it, expect } from 'vitest';
import {
  TECHNICIAN_PROFILES,
  getTechnicianProfile,
  matchTechnicianProfile,
  hasTechnicianProfile,
  getAllTechnicianProfiles,
} from '../technicianProfiles.js';
import {
  STANDARD_CAN_DO_SERVICES,
  STANDARD_HARD_MAX_STOPS,
  STANDARD_PREFERRED_MAX_STOPS,
} from '../technicianProfileDefaults.js';
import { technicians as SOURCE_ROSTER } from '../technicianRosterSource.js';

const EXPECTED_TECH_NAMES = [
  'Joshua Harrington',
  'Dimitri Rovinskinov',
  'Andrew Gregoire',
  'Cole Chenard',
  'Shayne McIntyre',
  'Alex Gray',
  'Jay Glaude',
  'Joseph Willey',
  'Jack Johnson',
  'Justin Giambusso',
  'Ian Pratt',
  'Patrick Carney',
  'Paige Bullock',
  'Chris McGary',
  'Tate Tibbetts',
  'Quincy Coachman',
  'Lee Pelletier',
  'Skyler Ruest',
  'Michael Caswell',
  'Matthew Lavigne',
];

describe('technicianProfiles — production roster', () => {
  it('live roster matches the source-of-truth technician count', () => {
    expect(SOURCE_ROSTER).toHaveLength(20);
    expect(TECHNICIAN_PROFILES).toHaveLength(20);
    expect(TECHNICIAN_PROFILES).toEqual(SOURCE_ROSTER);
  });

  it('includes every provided techName and no extras', () => {
    const liveNames = TECHNICIAN_PROFILES.map(profile => profile.techName).sort();
    expect(liveNames).toEqual([...EXPECTED_TECH_NAMES].sort());
  });

  it('has no duplicate techName values', () => {
    const names = TECHNICIAN_PROFILES.map(profile => profile.techName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('matches every technician by exact techName', () => {
    for (const techName of EXPECTED_TECH_NAMES) {
      expect(matchTechnicianProfile(techName)?.techName).toBe(techName);
      expect(hasTechnicianProfile(techName)).toBe(true);
    }
  });

  it('every technician uses standard stop limits', () => {
    for (const profile of TECHNICIAN_PROFILES) {
      expect(profile.preferredMaxStops).toBe(STANDARD_PREFERRED_MAX_STOPS);
      expect(profile.hardMaxStops).toBe(STANDARD_HARD_MAX_STOPS);
    }
  });

  it('every technician has full service capabilities', () => {
    for (const profile of TECHNICIAN_PROFILES) {
      expect(profile.canDoServices).toEqual(STANDARD_CAN_DO_SERVICES);
      expect(profile.cannotDoServices).toEqual([]);
      expect(profile.handlesCommercial).toBe(true);
      expect(profile.handlesBedBugs).toBe(true);
      expect(profile.handlesTickMosquito).toBe(true);
      expect(profile.handlesRodentWork).toBe(true);
    }
  });

  it('matches important aliases from the provided roster', () => {
    expect(getTechnicianProfile('Josh')?.techName).toBe('Joshua Harrington');
    expect(getTechnicianProfile('Dmitri')?.techName).toBe('Dimitri Rovinskinov');
    expect(getTechnicianProfile('Dmitri Rovinskinov')?.techName).toBe('Dimitri Rovinskinov');
    expect(getTechnicianProfile('Joe Willey')?.techName).toBe('Joseph Willey');
    expect(getTechnicianProfile('Mike')?.techName).toBe('Michael Caswell');
    expect(getTechnicianProfile('Matt')?.techName).toBe('Matthew Lavigne');
    expect(getTechnicianProfile('Andy Gregoire')?.techName).toBe('Andrew Gregoire');
  });

  it('does not include placeholder or test fixture technicians', () => {
    const names = TECHNICIAN_PROFILES.map(profile => profile.techName);
    expect(names).not.toContain('Example Tech (Placeholder)');
    expect(names).not.toContain('Chris Adams');
    expect(hasTechnicianProfile('Chris Adams')).toBe(false);
  });

  it('preserves source homeBase and service area data exactly', () => {
    const joshua = getTechnicianProfile('Joshua Harrington');
    expect(joshua.homeBase.address).toBe('25 Stark Ave, Dover, NH');
    expect(joshua.normalServiceAreas).toEqual([
      'Dover', 'Somersworth', 'Rochester', 'South Berwick', 'North Berwick', 'Eliot', 'York',
    ]);
    expect(joshua.notes).toBe('Primary NH Seacoast technician.');

    const joseph = getTechnicianProfile('Joseph Willey');
    expect(joseph.homeBase.address).toBe('13 Clearbrook Crossing, Kennebunk, ME');
    expect(joseph.normalServiceAreas).toEqual([
      'Kennebunk', 'Kennebunkport', 'Wells', 'Cape Porpoise', 'Arundel',
    ]);
  });

  it('getAllTechnicianProfiles returns a copy of the catalog', () => {
    const all = getAllTechnicianProfiles();
    expect(all).toHaveLength(20);
    expect(all).not.toBe(TECHNICIAN_PROFILES);
  });
});
