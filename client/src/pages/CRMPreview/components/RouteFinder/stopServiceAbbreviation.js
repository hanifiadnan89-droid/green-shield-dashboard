/**
 * Normalize FieldRoutes stop/appointment service labels to Route Finder abbreviations.
 */

const KNOWN_CODES = new Set(['RS', 'IQ', 'RIT', 'IS', 'T/M', 'BB', 'COM']);

const PATTERN_RULES = [
  { pattern: /\b(re[- ]?service|reservice)\b/i, code: 'RS' },
  { pattern: /\brodent\s+insect\s+triannual\b|\brit\b/i, code: 'RIT' },
  { pattern: /\binsect\s+quarterly\b|\bregular\s+quarterly\b|\biq\b/i, code: 'IQ' },
  { pattern: /\binitial\s+service\b|\binitial\b/i, code: 'IS' },
  { pattern: /\btick\s*(?:and|&)\s*mosquito\b|\bt\s*\/\s*m\b/i, code: 'T/M' },
  { pattern: /\bbed\s*bug\b|\bbb\b/i, code: 'BB' },
  { pattern: /\bcommercial\b|\bcom\b/i, code: 'COM' },
];

function normalizeCode(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (KNOWN_CODES.has(upper)) return upper;
  if (upper === 'TM') return 'T/M';
  return trimmed;
}

function matchPattern(text) {
  if (!text) return null;
  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(text)) return rule.code;
  }
  return null;
}

/**
 * @param {object} stop
 * @param {string} [stop.serviceCode]
 * @param {string} [stop.serviceType]
 * @param {string} [stop.serviceDescription]
 * @param {string} [stop.appointmentType]
 * @param {string[]} [stop.tags]
 * @param {string} [stop.notes]
 * @returns {string | null}
 */
export function getStopServiceAbbreviation(stop) {
  if (!stop) return null;

  const fromCode = normalizeCode(stop.serviceCode);
  if (fromCode && KNOWN_CODES.has(fromCode)) return fromCode;

  const fields = [
    stop.serviceType,
    stop.serviceDescription,
    stop.appointmentType,
    Array.isArray(stop.tags) ? stop.tags.join(' ') : null,
    stop.notes,
  ];

  for (const field of fields) {
    const matched = matchPattern(field);
    if (matched) return matched;
  }

  const looseCode = normalizeCode(stop.serviceCode);
  if (looseCode && KNOWN_CODES.has(looseCode)) return looseCode;

  return null;
}

/**
 * @param {object} lead
 * @param {string} [lead.serviceAbbreviation]
 * @param {string} [lead.serviceTypeId]
 * @param {string} [lead.serviceLabel]
 * @param {string} [lead.serviceType]
 */
export function getLeadServiceAbbreviation(lead) {
  if (!lead) return null;
  if (lead.serviceAbbreviation) return lead.serviceAbbreviation;
  return getStopServiceAbbreviation({
    serviceType: lead.serviceLabel || lead.serviceType,
    serviceDescription: lead.serviceType,
  });
}

/**
 * @param {object} stop
 * @returns {string}
 */
export function formatStopCustomerDisplayName(stop) {
  if (!stop) return 'Stop';
  const name = stop.customerName || 'Stop';
  const abbrev = stop.serviceAbbreviation;
  const label = abbrev ? `${name} (${abbrev})` : name;
  return stop.isNew ? `NEW · ${label}` : label;
}
