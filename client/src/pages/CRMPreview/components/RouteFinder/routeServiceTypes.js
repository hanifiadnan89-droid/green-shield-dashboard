/**
 * Service type catalog for Route Finder job duration and confidence.
 */

export const CUSTOM_DURATION_ID = 'custom-duration';

export const DURATION_MIN_LIMIT = 10;
export const DURATION_MAX_LIMIT = 240;

/** @typedef {'standard' | 'estimated' | 'custom' | 'inferred' | 'fallback'} DurationConfidence */

/**
 * @typedef {Object} RouteServiceType
 * @property {string} id
 * @property {string} label
 * @property {number} defaultDurationMinutes
 * @property {string} category
 * @property {string} description
 * @property {DurationConfidence} durationConfidence
 * @property {string} [notes]
 * @property {boolean} [isInitial]
 * @property {boolean} [isRecurring]
 * @property {boolean} [isReservice]
 */

/** @type {RouteServiceType[]} */
export const ROUTE_SERVICE_TYPES = [
  {
    id: 'initial-service',
    label: 'Initial Service',
    defaultDurationMinutes: 60,
    category: 'Initial',
    description: 'Standard initial pest service',
    durationConfidence: 'standard',
    isInitial: true,
  },
  {
    id: 'subscription-initial',
    label: 'Subscription Initial',
    defaultDurationMinutes: 60,
    category: 'Initial',
    description: 'Subscription account initial visit',
    durationConfidence: 'standard',
    isInitial: true,
  },
  {
    id: 'iq-initial',
    label: 'IQ Initial',
    defaultDurationMinutes: 60,
    category: 'Insect Quarterly',
    description: 'Initial insect quarterly service',
    durationConfidence: 'standard',
    isInitial: true,
    notes: 'Owner presence typically required for initial quarterly visits.',
  },
  {
    id: 'iq-recurring',
    label: 'IQ Recurring / Quarterly',
    defaultDurationMinutes: 30,
    category: 'Insect Quarterly',
    description: 'Recurring insect quarterly service',
    durationConfidence: 'standard',
    isRecurring: true,
  },
  {
    id: 'rit-initial',
    label: 'RIT Initial',
    defaultDurationMinutes: 60,
    category: 'Rodent',
    description: 'Initial rodent / triannual service',
    durationConfidence: 'estimated',
    isInitial: true,
    notes: 'RIT initial uses 60 min unless explicitly overridden in config.',
  },
  {
    id: 'rit-recurring',
    label: 'RIT Recurring / Triannual',
    defaultDurationMinutes: 30,
    category: 'Rodent',
    description: 'Recurring rodent / triannual service',
    durationConfidence: 'estimated',
    isRecurring: true,
  },
  {
    id: 'tick-mosquito',
    label: 'Tick & Mosquito',
    defaultDurationMinutes: 30,
    category: 'Seasonal',
    description: 'Tick and mosquito treatment',
    durationConfidence: 'standard',
    notes: 'Owner does not need to be home; photo or phone availability helps.',
  },
  {
    id: 'bed-bug',
    label: 'Bed Bug Service',
    defaultDurationMinutes: 60,
    category: 'Bed Bug',
    description: 'Bed bug inspection or treatment',
    durationConfidence: 'estimated',
    isInitial: true,
    notes: 'Owner should be home for bed bug visits.',
  },
  {
    id: 'reservice',
    label: 'Re-service',
    defaultDurationMinutes: 30,
    category: 'Re-service',
    description: 'Re-service visit',
    durationConfidence: 'standard',
    isReservice: true,
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
      durationSource: 'user',
      serviceType: type.label,
      serviceLabel: type.label,
      isInitial: false,
      isRecurring: false,
      isReservice: false,
    };
  }

  return {
    valid: true,
    durationMinutes: type.defaultDurationMinutes,
    durationConfidence: type.durationConfidence,
    durationSource: 'catalog',
    serviceType: type.label,
    serviceLabel: type.label,
    isInitial: Boolean(type.isInitial),
    isRecurring: Boolean(type.isRecurring),
    isReservice: Boolean(type.isReservice),
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
      durationSource: duration.durationSource,
      isInitial: duration.isInitial,
      isRecurring: duration.isRecurring,
      isReservice: duration.isReservice,
      timeWindowPreference,
      routeArea,
      date: date ?? null,
      notes: notes.trim() || null,
      callAheadRequired: Boolean(callAheadRequired),
    },
  };
}
