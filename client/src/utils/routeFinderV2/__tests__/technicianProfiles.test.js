import { describe, it, expect } from 'vitest';
import {
  TECHNICIAN_PROFILES,
  getTechnicianProfile,
  matchTechnicianProfile,
  hasTechnicianProfile,
  getAllTechnicianProfiles,
} from '../technicianProfiles.js';

describe('technicianProfiles', () => {
  it('exports example profiles with required shape', () => {
    expect(TECHNICIAN_PROFILES.length).toBeGreaterThanOrEqual(2);
    for (const profile of TECHNICIAN_PROFILES) {
      expect(typeof profile.techName).toBe('string');
      expect(Array.isArray(profile.aliases)).toBe(true);
      expect(profile.homeBase).toMatchObject({
        address: expect.any(String),
        town: expect.any(String),
        state: expect.any(String),
      });
      expect(typeof profile.preferredMaxStops).toBe('number');
      expect(typeof profile.hardMaxStops).toBe('number');
      expect(typeof profile.handlesCommercial).toBe('boolean');
      expect(typeof profile.notes).toBe('string');
    }
  });

  it('matches technician by exact name (case-insensitive)', () => {
    const profile = getTechnicianProfile('alex gray');
    expect(profile).not.toBeNull();
    expect(profile.techName).toBe('Alex Gray');
    expect(matchTechnicianProfile('ALEX GRAY')).toEqual(profile);
    expect(hasTechnicianProfile('Alex Gray')).toBe(true);
  });

  it('matches technician by alias (case-insensitive)', () => {
    const profile = matchTechnicianProfile('a. gray');
    expect(profile).not.toBeNull();
    expect(profile.techName).toBe('Alex Gray');

    const placeholder = matchTechnicianProfile('placeholder tech');
    expect(placeholder?.techName).toBe('Example Tech (Placeholder)');
  });

  it('returns null for unknown technicians', () => {
    expect(getTechnicianProfile('Unknown Person')).toBeNull();
    expect(hasTechnicianProfile('')).toBe(false);
    expect(hasTechnicianProfile(null)).toBe(false);
  });

  it('getAllTechnicianProfiles returns a copy of the catalog', () => {
    const all = getAllTechnicianProfiles();
    expect(all).toHaveLength(TECHNICIAN_PROFILES.length);
    expect(all).not.toBe(TECHNICIAN_PROFILES);
    expect(all[0]).toEqual(TECHNICIAN_PROFILES[0]);
  });
});
