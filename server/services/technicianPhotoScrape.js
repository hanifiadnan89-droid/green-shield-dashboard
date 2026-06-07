/**
 * Legacy About-page scrape helpers (retained for unit tests).
 * Production catalog uses bundled local images via technicianPhotoLocal.js.
 */

const ABOUT_URL = 'https://gshieldpest.com/about/';
const WP_MEDIA_SEARCH = 'https://gshieldpest.com/wp/v2/media?per_page=100&search=headshot';

export const TECHNICIAN_SECTION_MARKERS = {
  start: 'Lee G',
  end: 'Matt',
};

export function extractTeamNameOrder(html) {
  const names = [];
  const re = /<h3[^>]*>([^<]+)<\/h3>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    if (!name || name === 'Meet the Team') continue;
    names.push(name);
  }
  return names;
}

export function extractTechnicianNames(allNames) {
  const startIdx = allNames.indexOf(TECHNICIAN_SECTION_MARKERS.start);
  const endIdx = allNames.indexOf(TECHNICIAN_SECTION_MARKERS.end, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `Technician section not found on About page (expected ${TECHNICIAN_SECTION_MARKERS.start}–${TECHNICIAN_SECTION_MARKERS.end})`,
    );
  }
  return allNames.slice(startIdx, endIdx + 1);
}

export function buildTechnicianCatalog(allNames, photos) {
  const technicianNames = extractTechnicianNames(allNames);
  const byName = {};
  const unmatched = [];

  for (const name of technicianNames) {
    const globalIdx = allNames.indexOf(name);
    const photo = globalIdx >= 0 ? photos[globalIdx] : null;
    if (photo?.url) {
      byName[name] = photo.url;
    } else {
      byName[name] = null;
      unmatched.push(name);
    }
  }

  return { byName, technicians: technicianNames, unmatched };
}

export { ABOUT_URL, WP_MEDIA_SEARCH };
