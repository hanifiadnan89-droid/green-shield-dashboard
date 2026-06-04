/** Normalize a person name for fuzzy catalog lookup. */
export function normalizeTechnicianName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve a FieldRoutes technician name to a photo URL from the About-page catalog.
 * @param {string} techName
 * @param {Record<string, string|null>} byName
 * @returns {string|null}
 */
export function resolveTechnicianPhotoUrl(techName, byName = {}) {
  if (!techName || !byName || typeof byName !== 'object') return null;

  if (byName[techName]) return byName[techName];

  const normTech = normalizeTechnicianName(techName);
  if (!normTech) return null;

  const entries = Object.entries(byName).filter(([, url]) => url);

  for (const [key, url] of entries) {
    if (normalizeTechnicianName(key) === normTech) return url;
  }

  const techParts = normTech.split(/\s+/).filter(Boolean);
  const first = techParts[0];
  const last = techParts.length > 1 ? techParts[techParts.length - 1] : '';

  for (const [key, url] of entries) {
    const keyNorm = normalizeTechnicianName(key);
    const keyParts = keyNorm.split(/\s+/).filter(Boolean);

    if (keyParts.length === 1 && keyParts[0] === first) return url;

    if (keyParts.length >= 2 && keyParts[0] === first) {
      if (techParts.length === 1) return url;
      if (keyParts[1] === last[0] || keyNorm === normTech) return url;
      if (keyParts[1] === last) return url;
    }

    if (techParts.length >= 2 && keyParts.length >= 2) {
      if (keyParts[0] === first && keyParts[keyParts.length - 1] === last) return url;
    }
  }

  if (last) {
    const lastInitial = last[0];
    for (const [key, url] of entries) {
      const keyNorm = normalizeTechnicianName(key);
      const m = keyNorm.match(/^(\w+)\s+(\w)$/);
      if (m && m[1] === first && m[2] === lastInitial) return url;
    }
  }

  return null;
}

/** Initials for avatar fallback (max 2 chars). */
export function technicianInitials(techName) {
  const parts = String(techName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
