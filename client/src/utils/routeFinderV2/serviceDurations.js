/**
 * Route Finder V2 — service duration catalog.
 * Not wired into live scoring yet.
 */

/**
 * @typedef {Object} ServiceDurationRule
 * @property {string} serviceType
 * @property {string} label
 * @property {number} defaultMinutes
 * @property {number} [minMinutes]
 * @property {number} [maxMinutes]
 * @property {number} bufferMinutes
 * @property {string} serviceCategory
 */

/** @type {ServiceDurationRule[]} */
export const SERVICE_DURATION_RULES = [
  {
    serviceType: 'RIT',
    label: 'Rodent Insect Triannual',
    defaultMinutes: 60,
    minMinutes: 45,
    maxMinutes: 90,
    bufferMinutes: 10,
    serviceCategory: 'Rodent',
  },
  {
    serviceType: 'IQ',
    label: 'Insect Quarterly',
    defaultMinutes: 60,
    minMinutes: 45,
    maxMinutes: 75,
    bufferMinutes: 10,
    serviceCategory: 'Insect',
  },
  {
    serviceType: 'TICK_MOSQUITO',
    label: 'Tick & Mosquito',
    defaultMinutes: 30,
    minMinutes: 20,
    maxMinutes: 45,
    bufferMinutes: 5,
    serviceCategory: 'Seasonal',
  },
  {
    serviceType: 'BED_BUG',
    label: 'Bed Bug Service',
    defaultMinutes: 60,
    minMinutes: 45,
    maxMinutes: 120,
    bufferMinutes: 15,
    serviceCategory: 'Bed Bug',
  },
  {
    serviceType: 'COMMERCIAL',
    label: 'Commercial Service',
    defaultMinutes: 90,
    minMinutes: 60,
    maxMinutes: 120,
    bufferMinutes: 15,
    serviceCategory: 'Commercial',
  },
  {
    serviceType: 'RESERVICE',
    label: 'Re-service',
    defaultMinutes: 30,
    bufferMinutes: 5,
    serviceCategory: 'Re-service',
  },
  {
    serviceType: 'FOLLOW_UP',
    label: 'Follow-up',
    defaultMinutes: 30,
    bufferMinutes: 5,
    serviceCategory: 'Follow-up',
  },
  {
    serviceType: 'GENERAL',
    label: 'General Service',
    defaultMinutes: 30,
    bufferMinutes: 5,
    serviceCategory: 'General',
  },
];

const DURATION_BY_TYPE = new Map(
  SERVICE_DURATION_RULES.map(rule => [rule.serviceType, rule]),
);

const GENERAL_FALLBACK = DURATION_BY_TYPE.get('GENERAL');

const LEAD_SERVICE_ALIASES = new Map([
  ['rit', 'RIT'],
  ['iq', 'IQ'],
  ['t/m', 'TICK_MOSQUITO'],
  ['tm', 'TICK_MOSQUITO'],
  ['tick_mosquito', 'TICK_MOSQUITO'],
  ['tick & mosquito', 'TICK_MOSQUITO'],
  ['tick and mosquito', 'TICK_MOSQUITO'],
  ['bb', 'BED_BUG'],
  ['bed bug', 'BED_BUG'],
  ['bed bug service', 'BED_BUG'],
  ['com', 'COMMERCIAL'],
  ['commercial', 'COMMERCIAL'],
  ['commercial service', 'COMMERCIAL'],
  ['reservice', 'RESERVICE'],
  ['re-service', 'RESERVICE'],
  ['follow_up', 'FOLLOW_UP'],
  ['follow-up', 'FOLLOW_UP'],
  ['general', 'GENERAL'],
]);

function normalizeServiceKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9/&]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} serviceType
 * @returns {ServiceDurationRule}
 */
export function getServiceDuration(serviceType) {
  const key = String(serviceType ?? '').trim().toUpperCase();
  return DURATION_BY_TYPE.get(key) ?? GENERAL_FALLBACK;
}

/**
 * @param {string} serviceType
 * @returns {number}
 */
export function getServiceBuffer(serviceType) {
  return getServiceDuration(serviceType).bufferMinutes;
}

/**
 * Resolve V2 service type key from a Route Finder lead object.
 * @param {object|null|undefined} lead
 * @returns {string}
 */
export function resolveLeadServiceTypeKey(lead) {
  if (!lead) return 'GENERAL';

  const abbreviation = normalizeServiceKey(lead.serviceAbbreviation);
  if (abbreviation && LEAD_SERVICE_ALIASES.has(abbreviation)) {
    return LEAD_SERVICE_ALIASES.get(abbreviation);
  }

  const serviceTypeId = normalizeServiceKey(lead.serviceTypeId);
  const idMap = {
    it: 'RIT',
    iq: 'IQ',
    'tick mosquito': 'TICK_MOSQUITO',
    'bed bugs': 'BED_BUG',
    commercial: 'COMMERCIAL',
    reservice: 'RESERVICE',
    'follow up': 'FOLLOW_UP',
  };
  if (idMap[serviceTypeId]) return idMap[serviceTypeId];

  const labelKey = normalizeServiceKey(lead.serviceLabel || lead.serviceType);
  if (LEAD_SERVICE_ALIASES.has(labelKey)) return LEAD_SERVICE_ALIASES.get(labelKey);

  if (lead.isCommercial) return 'COMMERCIAL';
  if (lead.isReservice) return 'RESERVICE';

  return 'GENERAL';
}

/**
 * @param {object|null|undefined} lead
 * @returns {{ serviceType: string, rule: ServiceDurationRule, durationMinutes: number, bufferMinutes: number }}
 */
export function resolveServiceDurationFromLead(lead) {
  const serviceType = resolveLeadServiceTypeKey(lead);
  const rule = getServiceDuration(serviceType);
  const leadMinutes = Number(lead?.durationMinutes);
  const hasLeadMinutes = Number.isFinite(leadMinutes) && leadMinutes > 0;
  let durationMinutes = hasLeadMinutes ? leadMinutes : rule.defaultMinutes;

  if (rule.minMinutes != null) durationMinutes = Math.max(durationMinutes, rule.minMinutes);
  if (rule.maxMinutes != null) durationMinutes = Math.min(durationMinutes, rule.maxMinutes);

  return {
    serviceType,
    rule,
    durationMinutes,
    bufferMinutes: rule.bufferMinutes,
  };
}
