/**
 * Test-only technician profiles for Route Finder scoring fixtures.
 * Not included in production TECHNICIAN_PROFILES exports.
 */

import { createStandardTechnicianProfile } from '../technicianProfileDefaults.js';

/** @type {import('../technicianProfiles.js').TechnicianProfile} */
export const CHRIS_ADAMS_TEST_FIXTURE_PROFILE = createStandardTechnicianProfile({
  techName: 'Chris Adams',
  aliases: ['C. Adams'],
  homeBase: {
    address: '',
    town: 'Wells',
    state: 'ME',
    lat: 43.322,
    lng: -70.584,
  },
  normalServiceAreas: ['Southern Maine', 'Kennebunk / Wells / Sanford area'],
  notes: 'TEST FIXTURE ONLY — used by fieldRoutesScorer.fixtures maineMwfCluster.',
});
