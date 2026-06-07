/** Normalize a person name for catalog lookup. */
export function normalizeTechnicianName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** @typedef {'exact'|'normalized'|'first-last-initial'|'first-last'|'first-name'|'none'} TechnicianPhotoMatchType */

/**
 * @param {string} name
 * @returns {{ raw: string, normalized: string, parts: string[], first: string, last: string, lastInitial: string }}
 */
export function parseTechnicianNameParts(name) {
  const raw = String(name || '').trim();
  const normalized = normalizeTechnicianName(raw);
  const parts = normalized.split(/\s+/).filter(Boolean);
  const first = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const lastInitial = last ? last[0] : '';
  return { raw, normalized, parts, first, last, lastInitial };
}

/**
 * @param {Record<string, string|null>} byName
 * @returns {Map<string, string[]>}
 */
function buildFirstNameIndex(byName) {
  const index = new Map();
  for (const key of Object.keys(byName)) {
    if (!byName[key]) continue;
    const { first } = parseTechnicianNameParts(key);
    if (!first) continue;
    const list = index.get(first) || [];
    list.push(key);
    index.set(first, list);
  }
  return index;
}

/**
 * Whether a catalog key uses a single-letter disambiguator (e.g. "Lee G", "Chris M").
 * @param {string} catalogKey
 */
function catalogKeyHasLastInitial(catalogKey) {
  const parts = normalizeTechnicianName(catalogKey).split(/\s+/).filter(Boolean);
  return parts.length === 2 && parts[1].length === 1;
}

/**
 * @param {string} techName
 * @param {string} catalogKey
 * @returns {boolean}
 */
function matchesFirstLastInitial(techName, catalogKey) {
  const tech = parseTechnicianNameParts(techName);
  const key = parseTechnicianNameParts(catalogKey);

  if (!tech.first || tech.first !== key.first) return false;
  if (!catalogKeyHasLastInitial(catalogKey)) return false;
  if (tech.parts.length < 2) return false;

  return key.parts[1] === tech.lastInitial;
}

/**
 * @param {string} techName
 * @param {string} catalogKey
 * @returns {boolean}
 */
function matchesFirstAndLastName(techName, catalogKey) {
  const tech = parseTechnicianNameParts(techName);
  const key = parseTechnicianNameParts(catalogKey);

  if (!tech.first || tech.first !== key.first) return false;
  if (tech.parts.length < 2) return false;

  if (key.parts.length === 1) return true;

  if (catalogKeyHasLastInitial(catalogKey)) {
    return key.parts[1] === tech.lastInitial;
  }

  return key.last === tech.last || key.parts[1] === tech.lastInitial;
}

/**
 * @param {string} techName
 * @param {Record<string, string|null>} byName
 * @param {{ logger?: (msg: string, detail?: Record<string, unknown>) => void }} [options]
 * @returns {{ url: string|null, matchType: TechnicianPhotoMatchType, catalogKey: string|null }}
 */
export function resolveTechnicianPhoto(techName, byName = {}, options = {}) {
  const { logger = null } = options;
  const log = (matchType, catalogKey, url) => {
    if (!logger) return;
    logger(`[technician-photo] ${matchType} match`, {
      techName,
      catalogKey,
      url: url ? '(set)' : null,
    });
  };

  if (!techName || !byName || typeof byName !== 'object') {
    if (logger) logger('[technician-photo] no match', { techName, reason: 'empty-input' });
    return { url: null, matchType: 'none', catalogKey: null };
  }

  const entries = Object.entries(byName).filter(([, url]) => url);
  if (entries.length === 0) {
    if (logger) logger('[technician-photo] no match', { techName, reason: 'empty-catalog' });
    return { url: null, matchType: 'none', catalogKey: null };
  }

  if (byName[techName]) {
    log('exact', techName, byName[techName]);
    return { url: byName[techName], matchType: 'exact', catalogKey: techName };
  }

  const tech = parseTechnicianNameParts(techName);
  if (!tech.normalized) {
    if (logger) logger('[technician-photo] no match', { techName, reason: 'empty-name' });
    return { url: null, matchType: 'none', catalogKey: null };
  }

  for (const [key, url] of entries) {
    if (normalizeTechnicianName(key) === tech.normalized) {
      log('normalized', key, url);
      return { url, matchType: 'normalized', catalogKey: key };
    }
  }

  const firstNameIndex = buildFirstNameIndex(byName);

  const initialMatches = entries.filter(([key]) => matchesFirstLastInitial(techName, key));
  if (initialMatches.length === 1) {
    const [key, url] = initialMatches[0];
    log('first-last-initial', key, url);
    return { url, matchType: 'first-last-initial', catalogKey: key };
  }

  if (tech.parts.length >= 2) {
    const fullMatches = entries.filter(([key]) => matchesFirstAndLastName(techName, key));
    const unambiguous = fullMatches.filter(([key]) => {
      if (catalogKeyHasLastInitial(key)) return true;
      const peers = firstNameIndex.get(tech.first) || [];
      return peers.length === 1;
    });

    if (unambiguous.length === 1) {
      const [key, url] = unambiguous[0];
      log('first-last', key, url);
      return { url, matchType: 'first-last', catalogKey: key };
    }
  }

  if (tech.parts.length === 1) {
    const peers = firstNameIndex.get(tech.first) || [];
    const singleWordPeers = peers.filter(key => parseTechnicianNameParts(key).parts.length === 1);
    if (singleWordPeers.length === 1) {
      const key = singleWordPeers[0];
      const url = byName[key];
      log('first-name', key, url);
      return { url, matchType: 'first-name', catalogKey: key };
    }
  }

  if (logger) {
    logger('[technician-photo] no match', {
      techName,
      reason: initialMatches.length > 1 ? 'ambiguous-initial' : 'no-confident-match',
    });
  }
  return { url: null, matchType: 'none', catalogKey: null };
}

/**
 * Resolve a FieldRoutes technician name to a photo URL from the technician catalog.
 * @param {string} techName
 * @param {Record<string, string|null>} byName
 * @param {{ logger?: (msg: string, detail?: Record<string, unknown>) => void }} [options]
 * @returns {string|null}
 */
export function resolveTechnicianPhotoUrl(techName, byName = {}, options = {}) {
  return resolveTechnicianPhoto(techName, byName, options).url;
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
