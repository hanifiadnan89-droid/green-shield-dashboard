/**
 * Production Route Finder V2 technician roster.
 * FieldRoutes techName values with dispatcher-facing aliases.
 */

import { createStandardTechnicianProfile } from './technicianProfileDefaults.js';

const SOUTHERN_MAINE = 'Southern Maine';
const SEACOAST_NH = 'Seacoast NH';
const GREATER_PORTLAND = 'Greater Portland';
const KENNEBUNK_WELLS_SANFORD = 'Kennebunk / Wells / Sanford area';
const BRUNSWICK_MIDCOAST = 'Brunswick / Midcoast';
const OXFORD_WESTERN = 'Oxford / Rumford / Western Maine';

/** @type {import('./technicianProfiles.js').TechnicianProfile[]} */
export const PRODUCTION_TECHNICIAN_ROSTER = [
  createStandardTechnicianProfile({
    techName: 'Alex Gray',
    aliases: ['A. Gray', 'Alex G.', 'Alex'],
    homeBase: { address: '', town: 'Portsmouth', state: 'NH', lat: null, lng: null },
    normalServiceAreas: [SEACOAST_NH],
    notes: 'Primary New Hampshire technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Dimitri Rovinskinov',
    aliases: ['Dmitri Rovinskinov', 'Dmitri', 'Dimitri'],
    homeBase: { address: '', town: 'Biddeford', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [SOUTHERN_MAINE, GREATER_PORTLAND],
    notes: 'Southern Maine / Portland-area routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Joseph Willey',
    aliases: ['Joe Willey', 'Joe'],
    homeBase: { address: '', town: 'Kennebunk', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [KENNEBUNK_WELLS_SANFORD, SOUTHERN_MAINE],
    notes: 'Coastal southern Maine — Kennebunk base.',
  }),
  createStandardTechnicianProfile({
    techName: 'Joshua Harrington',
    aliases: ['Josh Harrington', 'Josh'],
    homeBase: { address: '', town: 'Saco', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND, SOUTHERN_MAINE],
    notes: 'Greater Portland and southern Maine coverage.',
  }),
  createStandardTechnicianProfile({
    techName: 'Michael Caswell',
    aliases: ['Mike Caswell', 'Mike'],
    homeBase: { address: '', town: 'Brunswick', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [BRUNSWICK_MIDCOAST],
    notes: 'Brunswick / midcoast technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Matthew Lavigne',
    aliases: ['Matt Lavigne', 'Matt'],
    homeBase: { address: '', town: 'Lewiston', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [OXFORD_WESTERN, GREATER_PORTLAND],
    notes: 'Western Maine and greater Portland coverage.',
  }),
  createStandardTechnicianProfile({
    techName: 'Lee Goodwin',
    aliases: ['Lee G'],
    homeBase: { address: '', town: 'Biddeford', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [SOUTHERN_MAINE],
    notes: 'Southern Maine coastal routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Lee Porter',
    aliases: ['Lee P'],
    homeBase: { address: '', town: 'Auburn', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND, OXFORD_WESTERN, BRUNSWICK_MIDCOAST],
    notes: 'Portland through Augusta corridor.',
  }),
  createStandardTechnicianProfile({
    techName: 'Chris Miller',
    aliases: ['Chris M'],
    homeBase: { address: '', town: 'Saco', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND, SOUTHERN_MAINE],
    notes: 'Greater Portland and southern Maine.',
  }),
  createStandardTechnicianProfile({
    techName: 'Jack',
    aliases: [],
    homeBase: { address: '', town: 'Kennebunk', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [KENNEBUNK_WELLS_SANFORD, SOUTHERN_MAINE],
    notes: 'Kennebunk-area technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Paige',
    aliases: [],
    homeBase: { address: '', town: 'Portland', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND],
    notes: 'Greater Portland technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Andrew',
    aliases: [],
    homeBase: { address: '', town: 'Portland', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND, SOUTHERN_MAINE],
    notes: 'Portland and southern Maine routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Quincy',
    aliases: [],
    homeBase: { address: '', town: 'Sabattus', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [BRUNSWICK_MIDCOAST, OXFORD_WESTERN],
    notes: 'Sabattus / midcoast and western Maine routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Ian Pratt',
    aliases: ['Ian'],
    homeBase: { address: '', town: 'Portland', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND],
    notes: 'Greater Portland technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Jay Glaude',
    aliases: ['Jay'],
    homeBase: { address: '', town: 'Westbrook', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND],
    notes: 'Greater Portland technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Tate Tibbetts',
    aliases: ['Tate'],
    homeBase: { address: '', town: 'Portland', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND, SOUTHERN_MAINE],
    notes: 'Portland and southern Maine routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Skyler Ruest',
    aliases: ['Skyler'],
    homeBase: { address: '', town: 'Biddeford', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [SOUTHERN_MAINE, GREATER_PORTLAND],
    notes: 'Southern Maine and Portland-area routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Patrick Carney',
    aliases: ['Patrick'],
    homeBase: { address: '', town: 'Sanford', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [KENNEBUNK_WELLS_SANFORD, SOUTHERN_MAINE],
    notes: 'Sanford / southern Maine routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Ed Croy',
    aliases: ['Ed'],
    homeBase: { address: '', town: 'Saco', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND, SOUTHERN_MAINE],
    notes: 'Portland and southern Maine routing.',
  }),
  createStandardTechnicianProfile({
    techName: 'Justin Giambusso',
    aliases: ['Justin'],
    homeBase: { address: '', town: 'Windham', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND],
    notes: 'Greater Portland technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Greyson Bilodeau',
    aliases: ['Greyson'],
    homeBase: { address: '', town: 'Gorham', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [GREATER_PORTLAND],
    notes: 'Greater Portland technician.',
  }),
  createStandardTechnicianProfile({
    techName: 'Cole Chenard',
    aliases: ['Cole'],
    homeBase: { address: '', town: 'Old Orchard Beach', state: 'ME', lat: null, lng: null },
    normalServiceAreas: [SOUTHERN_MAINE, GREATER_PORTLAND],
    notes: 'Southern Maine coastal routing.',
  }),
];
