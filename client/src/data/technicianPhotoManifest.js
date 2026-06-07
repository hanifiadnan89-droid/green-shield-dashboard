/**
 * Authoritative Route Finder technician photos (bundled under /technicians/*).
 * Source: gshieldpest.com/about Technicians section (per-person image boxes).
 */

/** @type {Record<string, string>} Display name → public URL path */
export const TECHNICIAN_PHOTO_BY_NAME = {
  'Lee G': '/technicians/lee_g.jpeg',
  'Lee P': '/technicians/lee_p.jpeg',
  'Chris M': '/technicians/chris_m.jpeg',
  Alex: '/technicians/alex.jpeg',
  Jack: '/technicians/jack.jpeg',
  Paige: '/technicians/paige.jpeg',
  Andrew: '/technicians/andrew.jpeg',
  Quincy: '/technicians/quincy.jpeg',
  Joe: '/technicians/joe.jpeg',
  Mike: '/technicians/mike.jpg',
  Ian: '/technicians/ian.jpg',
  Jay: '/technicians/jay.jpg',
  Tate: '/technicians/tate.jpg',
  Skyler: '/technicians/skyler.jpg',
  Patrick: '/technicians/patrick.jpg',
  Ed: '/technicians/ed.jpg',
  Justin: '/technicians/justin.jpg',
  Greyson: '/technicians/greyson.jpg',
  Josh: '/technicians/josh.jpg',
  Cole: '/technicians/cole.jpg',
  Matt: '/technicians/matt.jpg',
};

/**
 * FieldRoutes / full-name aliases → canonical display name.
 * Only entries verified from official About-page image filenames.
 */
export const TECHNICIAN_PHOTO_ALIASES = {
  'Ed Croy': 'Ed',
  'Mike Caswell': 'Mike',
  'Ian Pratt': 'Ian',
  'Jay Glaude': 'Jay',
  'Tate Tibbetts': 'Tate',
  'Skyler Ruest': 'Skyler',
  'Patrick Carney': 'Patrick',
  'Justin Giambusso': 'Justin',
  'Greyson Bilodeau': 'Greyson',
  'Josh Harrington': 'Josh',
  'Cole Chenard': 'Cole',
  'Matt Lavigne': 'Matt',
};

export const TECHNICIAN_DISPLAY_NAMES = Object.keys(TECHNICIAN_PHOTO_BY_NAME);

/** @returns {Record<string, string>} */
export function getLocalTechnicianPhotoCatalog() {
  return { ...TECHNICIAN_PHOTO_BY_NAME };
}
