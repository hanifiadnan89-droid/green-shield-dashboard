/**
 * Company service-duration rules for Route Finder.
 * Used to infer existing appointment lengths and validate new-customer defaults.
 */

/** @typedef {'exact' | 'inferred' | 'fallback' | 'unknown'} DurationConfidence */

/**
 * @typedef {Object} DurationRule
 * @property {string} id
 * @property {string} label
 * @property {RegExp[]} matchPatterns
 * @property {number} durationMinutes
 * @property {DurationConfidence} confidence
 * @property {string} [notes]
 */

/** @type {DurationRule[]} */
export const ROUTE_SERVICE_DURATION_RULES = [
  {
    id: 'initial-service',
    label: 'Initial Service',
    matchPatterns: [/\binitial\b/i, /\binit\b/i, /\bsubscription\s*initial\b/i],
    durationMinutes: 60,
    confidence: 'inferred',
    notes: 'Any initial or subscription initial visit.',
  },
  {
    id: 'iq-recurring',
    label: 'IQ / Quarterly Recurring',
    matchPatterns: [
      /\binsect\s*quarterly\b/i,
      /\biq\b/i,
      /\bquarterly\b/i,
      /\brecurring\b/i,
      /\bregular\s*service\b/i,
    ],
    durationMinutes: 30,
    confidence: 'inferred',
  },
  {
    id: 'reservice',
    label: 'Re-service',
    matchPatterns: [/\bre[\s-]?service\b/i, /\breservice\b/i],
    durationMinutes: 30,
    confidence: 'inferred',
  },
  {
    id: 'tick-mosquito',
    label: 'Tick & Mosquito',
    matchPatterns: [/\btick\b/i, /\bmosquito\b/i, /\bt\s*&\s*m\b/i, /\bt\/m\b/i],
    durationMinutes: 30,
    confidence: 'inferred',
  },
  {
    id: 'bed-bug',
    label: 'Bed Bug',
    matchPatterns: [/\bbed\s*bug\b/i],
    durationMinutes: 60,
    confidence: 'inferred',
  },
  {
    id: 'rit-initial',
    label: 'RIT Initial',
    matchPatterns: [/\brit\b.*\binitial\b/i, /\brodent\b.*\binitial\b/i, /\btriannual\b.*\binitial\b/i],
    durationMinutes: 60,
    confidence: 'inferred',
    notes: 'Rodent/Insect Triannual initial — override in config if company policy changes.',
  },
  {
    id: 'rit-recurring',
    label: 'RIT Recurring / Triannual',
    matchPatterns: [/\brit\b/i, /\brodent\b/i, /\btriannual\b/i, /\btri[\s-]?annual\b/i],
    durationMinutes: 30,
    confidence: 'inferred',
    notes: 'Ambiguous RIT without explicit initial defaults to 30 min with low confidence.',
  },
  {
    id: 'commercial',
    label: 'Commercial',
    matchPatterns: [/\bcommercial\b/i],
    durationMinutes: 60,
    confidence: 'inferred',
  },
];

export const DEFAULT_DURATION_MINUTES = 30;
export const DEFAULT_DURATION_CONFIDENCE = 'fallback';

const RULE_ORDER = [...ROUTE_SERVICE_DURATION_RULES];

function collectSearchText(stop = {}) {
  return [
    stop.serviceType,
    stop.serviceCode,
    stop.serviceDescription,
    stop.appointmentType,
    stop.tags,
    stop.notes,
    stop.status,
  ]
    .filter(Boolean)
    .join(' ');
}

function matchRule(text) {
  for (const rule of RULE_ORDER) {
    if (rule.matchPatterns.some(re => re.test(text))) return rule;
  }
  return null;
}

/**
 * Infer how long an existing FieldRoutes stop will take on site.
 * @param {Object} stop
 * @returns {{ durationMinutes: number, confidence: DurationConfidence, source: string, ruleId: string|null, warnings: string[] }}
 */
export function inferAppointmentDurationMinutes(stop = {}) {
  const warnings = [];
  const rawDuration = Number(stop.durationMinutes ?? stop.duration);
  if (Number.isFinite(rawDuration) && rawDuration > 0 && rawDuration <= 480) {
    return {
      durationMinutes: Math.round(rawDuration),
      confidence: 'exact',
      source: 'fieldroutes',
      ruleId: null,
      warnings,
    };
  }

  const text = collectSearchText(stop);
  const rule = text ? matchRule(text) : null;

  if (rule) {
    const isAmbiguousRit =
      rule.id === 'rit-recurring' &&
      /\brit\b|\btriannual\b|\brodent\b/i.test(text) &&
      !/\binitial\b/i.test(text);

    if (isAmbiguousRit) {
      warnings.push('RIT/triannual duration inferred as 30 min — code did not clearly indicate initial.');
    }

    return {
      durationMinutes: rule.durationMinutes,
      confidence: rule.confidence,
      source: 'rule',
      ruleId: rule.id,
      warnings,
    };
  }

  warnings.push('No service tag matched — using default 30-minute fallback.');
  return {
    durationMinutes: DEFAULT_DURATION_MINUTES,
    confidence: DEFAULT_DURATION_CONFIDENCE,
    source: 'fallback',
    ruleId: null,
    warnings,
  };
}

/**
 * Enrich stops with inferred durations for scoring.
 * @param {Array<Object>} stops
 */
export function enrichStopsWithDurations(stops = []) {
  let fallbackCount = 0;
  const enriched = stops.map(stop => {
    const inferred = inferAppointmentDurationMinutes(stop);
    if (inferred.confidence === 'fallback' || inferred.confidence === 'unknown') {
      fallbackCount += 1;
    }
    return {
      ...stop,
      durationMinutes: inferred.durationMinutes,
      durationConfidence: inferred.confidence,
      durationSource: inferred.source,
      durationRuleId: inferred.ruleId,
      durationWarnings: inferred.warnings,
    };
  });

  return {
    stops: enriched,
    fallbackCount,
    warnings:
      fallbackCount >= 3
        ? [`${fallbackCount} stops use fallback duration estimates — workload may be approximate.`]
        : [],
  };
}
