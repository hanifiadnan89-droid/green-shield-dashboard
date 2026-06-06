/**
 * Service type catalog for Route Finder job duration and confidence.
 */

export const CUSTOM_DURATION_ID = 'custom-duration';

export const DURATION_MIN_LIMIT = 10;
export const DURATION_MAX_LIMIT = 240;

/** @typedef {'standard' | 'estimated' | 'custom'} DurationConfidence */

/**
 * @typedef {Object} RouteServiceType
 * @property {string} id
 * @property {string} label
 * @property {number} defaultDurationMinutes
 * @property {string} category
 * @property {string} description
 * @property {DurationConfidence} durationConfidence
 * @property {string} [notes]
 */

/** @type {RouteServiceType[]} */
export const ROUTE_SERVICE_TYPES = [
  {
    id: 'iq-initial',
    label: 'IQ Initial',
    defaultDurationMinutes: 60,
    category: 'Insect Quarterly',
    description: 'Initial insect quarterly service',
    durationConfidence: 'standard',
    notes: 'Owner presence typically required for initial quarterly visits.',
  },
  {
    id: 'iq-recurring',
    label: 'IQ Recurring',
    defaultDurationMinutes: 30,
    category: 'Insect Quarterly',
    description: 'Recurring insect quarterly service',
    durationConfidence: 'standard',
  },
  {
    id: 'rit-initial',
    label: 'RIT Initial',
    defaultDurationMinutes: 75,
    category: 'Rodent',
    description: 'Initial rodent inspection and treatment',
    durationConfidence: 'estimated',
    notes: 'Duration varies with property size and entry-point complexity.',
  },
  {
    id: 'rit-recurring',
    label: 'RIT Recurring',
    defaultDurationMinutes: 45,
    category: 'Rodent',
    description: 'Recurring rodent service',
    durationConfidence: 'estimated',
  },
  {
    id: 'tick-mosquito',
    label: 'Tick & Mosquito',
    defaultDurationMinutes: 25,
    category: 'Seasonal',
    description: 'Tick and mosquito treatment',
    durationConfidence: 'standard',
    notes: 'Owner does not need to be home; photo or phone availability helps.',
  },
  {
    id: 'bed-bug-inspection',
    label: 'Bed Bug Inspection',
    defaultDurationMinutes: 45,
    category: 'Bed Bug',
    description: 'Bed bug inspection only',
    durationConfidence: 'estimated',
  },
  {
    id: 'bed-bug-treatment',
    label: 'Bed Bug Treatment',
    defaultDurationMinutes: 120,
    category: 'Bed Bug',
    description: 'Bed bug treatment visit',
    durationConfidence: 'estimated',
    notes: 'Owner should be home for initial bed bug treatments.',
  },
  {
    id: 'carpenter-ant',
    label: 'Carpenter Ant',
    defaultDurationMinutes: 45,
    category: 'Ant',
    description: 'Carpenter ant service',
    durationConfidence: 'estimated',
  },
  {
    id: 'inspection-only',
    label: 'Inspection Only',
    defaultDurationMinutes: 30,
    category: 'Inspection',
    description: 'General inspection without treatment',
    durationConfidence: 'standard',
  },
  {
    id: 'commercial',
    label: 'Commercial',
    defaultDurationMinutes: 60,
    category: 'Commercial',
    description: 'Commercial account service',
    durationConfidence: 'estimated',
    notes: 'Commercial sites often need longer on-site time.',
  },
  {
    id: 'wasp-hornet',
    label: 'Wasp/Hornet',
    defaultDurationMinutes: 45,
    category: 'Stinging Insects',
    description: 'Wasp or hornet nest treatment',
    durationConfidence: 'estimated',
  },
  {
    id: 'flea-treatment',
    label: 'Flea Treatment',
    defaultDurationMinutes: 60,
    category: 'Flea',
    description: 'Flea treatment service',
    durationConfidence: 'estimated',
  },
  {
    id: 'roach-treatment',
    label: 'Roach Treatment',
    defaultDurationMinutes: 60,
    category: 'Roach',
    description: 'Roach treatment service',
    durationConfidence: 'estimated',
  },
  {
    id: 'rodent-inspection',
    label: 'Rodent Inspection',
    defaultDurationMinutes: 45,
    category: 'Rodent',
    description: 'Rodent inspection without full treatment',
    durationConfidence: 'standard',
    notes: 'Owner presence recommended.',
  },
  {
    id: CUSTOM_DURATION_ID,
    label: 'Custom Duration',
    defaultDurationMinutes: 30,
    category: 'Custom',
    description: 'User-specified service duration',
    durationConfidence: 'custom',
    notes: 'Enter minutes manually when standard durations do not apply.',
  },
];

const BY_ID = new Map(ROUTE_SERVICE_TYPES.map(t => [t.id, t]));

export function getServiceTypeById(id) {
  return BY_ID.get(id) ?? null;
}

/**
 * Resolve duration minutes and confidence from service selection.
 * @param {string} serviceTypeId
 * @param {number | null | undefined} customDurationMinutes
 */
export function resolveServiceDuration(serviceTypeId, customDurationMinutes) {
  const type = getServiceTypeById(serviceTypeId);
  if (!type) {
    return { valid: false, error: 'Service type is required.' };
  }

  if (type.id === CUSTOM_DURATION_ID) {
    const mins = Number(customDurationMinutes);
    if (!Number.isFinite(mins) || mins < DURATION_MIN_LIMIT || mins > DURATION_MAX_LIMIT) {
      return {
        valid: false,
        error: `Custom duration must be between ${DURATION_MIN_LIMIT} and ${DURATION_MAX_LIMIT} minutes.`,
      };
    }
    return {
      valid: true,
      durationMinutes: Math.round(mins),
      durationConfidence: 'custom',
      serviceType: type.label,
      serviceLabel: type.label,
    };
  }

  return {
    valid: true,
    durationMinutes: type.defaultDurationMinutes,
    durationConfidence: type.durationConfidence,
    serviceType: type.label,
    serviceLabel: type.label,
  };
}

/**
 * Build a validated lead object for scoring.
 */
export function buildRouteFinderLead({
  lat,
  lng,
  address,
  customerName = '',
  notes = '',
  callAheadRequired = false,
  serviceTypeId,
  customDurationMinutes,
  timeWindowPreference,
  routeArea,
  date,
}) {
  const errors = [];

  if (lat == null || lng == null || !address?.trim()) {
    errors.push('A verified address with coordinates is required.');
  }
  if (!serviceTypeId) {
    errors.push('Service type is required.');
  }

  const duration = serviceTypeId
    ? resolveServiceDuration(serviceTypeId, customDurationMinutes)
    : { valid: false, error: 'Service type is required.' };

  if (!duration.valid) {
    errors.push(duration.error);
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    lead: {
      lat,
      lng,
      address: address.trim(),
      customerName: customerName.trim() || null,
      serviceType: duration.serviceType,
      serviceLabel: duration.serviceLabel,
      serviceTypeId,
      durationMinutes: duration.durationMinutes,
      durationConfidence: duration.durationConfidence,
      timeWindowPreference,
      routeArea,
      date: date ?? null,
      notes: notes.trim() || null,
      callAheadRequired: Boolean(callAheadRequired),
    },
  };
}
