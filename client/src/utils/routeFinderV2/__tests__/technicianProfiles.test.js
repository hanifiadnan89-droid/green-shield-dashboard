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
import { PRODUCTION_TECHNICIAN_ROSTER } from '../technicianRosterData.js';

describe('technicianProfiles — production roster', () => {
  it('imports every real technician profile successfully', () => {
    expect(TECHNICIAN_PROFILES.length).toBe(PRODUCTION_TECHNICIAN_ROSTER.length);
    expect(TECHNICIAN_PROFILES.length).toBeGreaterThanOrEqual(20);
    for (const profile of TECHNICIAN_PROFILES) {
      expect(typeof profile.techName).toBe('string');
      expect(profile.techName.length).toBeGreaterThan(0);
      expect(Array.isArray(profile.aliases)).toBe(true);
      expect(profile.homeBase).toMatchObject({
        town: expect.any(String),
        state: expect.any(String),
      });
    }
  });

  it('has no duplicate techName values', () => {
    const names = TECHNICIAN_PROFILES.map(profile => profile.techName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('matches every technician by exact techName', () => {
    for (const profile of TECHNICIAN_PROFILES) {
      expect(matchTechnicianProfile(profile.techName)?.techName).toBe(profile.techName);
      expect(hasTechnicianProfile(profile.techName)).toBe(true);
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
      expect(profile.canDoServices).toEqual(expect.arrayContaining(STANDARD_CAN_DO_SERVICES));
      expect(profile.cannotDoServices).toEqual([]);
      expect(profile.handlesCommercial).toBe(true);
      expect(profile.handlesBedBugs).toBe(true);
      expect(profile.handlesTickMosquito).toBe(true);
      expect(profile.handlesRodentWork).toBe(true);
    }
  });

  it('matches important aliases', () => {
    expect(getTechnicianProfile('Josh')?.techName).toBe('Joshua Harrington');
    expect(getTechnicianProfile('Dmitri')?.techName).toBe('Dimitri Rovinskinov');
    expect(getTechnicianProfile('Dmitri Rovinskinov')?.techName).toBe('Dimitri Rovinskinov');
    expect(getTechnicianProfile('Joe Willey')?.techName).toBe('Joseph Willey');
    expect(getTechnicianProfile('Mike')?.techName).toBe('Michael Caswell');
    expect(getTechnicianProfile('Matt')?.techName).toBe('Matthew Lavigne');
  });

  it('does not include placeholder or test fixture technicians', () => {
    const names = TECHNICIAN_PROFILES.map(profile => profile.techName);
    expect(names).not.toContain('Example Tech (Placeholder)');
    expect(names).not.toContain('Chris Adams');
  });

  it('getAllTechnicianProfiles returns a copy of the catalog', () => {
    const all = getAllTechnicianProfiles();
    expect(all).toHaveLength(TECHNICIAN_PROFILES.length);
    expect(all).not.toBe(TECHNICIAN_PROFILES);
  });
});
