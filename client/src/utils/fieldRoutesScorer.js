/**
 * FieldRoutes route scorer — geo-first insertion logic with internal route
 * pre-optimization.
 *
 * Pipeline per technician:
 *   1. optimizeRouteOrder() — nearest-neighbor + 2-opt TSP, timed anchors fixed
 *   2. findBestInsertion()  — test every N+1 slot in the optimized order
 *   3. scoreRoute()         — weighted scoring with bearing backtracking, cluster
 *                             quality, start/end fit, and rich output fields
 */

import {
  haversineMiles as haversine,
  travelMinutesFromMiles as travelMin,
  defaultTravelProvider,
} from './routeTravelTimeProvider.js';
import { enrichStopsWithDurations } from './routeServiceDurationRules.js';
import {
  assessRouteWorkload,
  applyLighterRoutePreference,
  ROUTE_WORKLOAD_CONFIG,
  workloadLabelDisplay,
} from './routeWorkload.js';
import {
  assessAreaViability,
  getAreaViabilityScoreAdjustments,
  selectTopMatchesByAreaViability,
} from './routeAreaViability.js';
import { ROUTE_AREA_VIABILITY_DEFAULTS } from './routeAreaViabilityConfig.js';
import {
  getStopServiceAbbreviation,
  getLeadServiceAbbreviation,
} from '../pages/CRMPreview/components/RouteFinder/stopServiceAbbreviation.js';
import { formatStopTimedWindowLabel } from '../pages/CRMPreview/components/RouteFinder/stopTimedWindow.js';

// ---------------------------------------------------------------------------
// SCORER_CONFIG — single source of truth for all weights, thresholds, and
// business rules. Centralised here so callers (tests, future A/B) can
// clone and override without touching algorithm code.
// ---------------------------------------------------------------------------
export const SCORER_CONFIG = {
  // 'vrptw' is the default engine as of Phase 5; 'legacy' retained for rollback
  engine: 'vrptw',

  // Scoring weights — must sum to 1.0 (dispatcher-grade balance)
  weights: {
    travel: 0.35,
    window: 0.25,
    workload: 0.20,
    serviceDuration: 0.10,
    geo: 0.10,
  },

  workload: { ...ROUTE_WORKLOAD_CONFIG },

  speed: {
    avgMph: 30,
    // Phase 3: replace with distance-based profile heuristic
    profiles: { urban: 22, suburban: 30, highway: 45 },
  },

  workday: {
    dayStartMin:    480,  // 8:00 AM
    dayEndMin:      1080, // 6:00 PM
    defaultMaxHours: 10.5,
  },

  thresholds: {
    clusterRadiusMiles:  5,
    geoZeroMiles:        15,
    travelZeroMiles:     8,
    homeNearMiles:       5,
    timedWindowMaxMin:   360, // ≤ 6-hour window = timed stop
  },

  // Service duration defaults by type (minutes)
  durations: {
    map: {
      'Regular Service':             30,
      'T&M':                         30,
      'Initial Service':             60,
      'Initial':                     60,
      'Tick and Mosquito':           30,
      'Tick and Mosquito Service':   30,
      'Insect Quarterly':            30,
      'Insect Quarterly Service':    30,
      'Re-service':                  30,
      'Reservice':                   30,
      'Commercial Account':          60,
      'Commercial Service':          60,
      'Commercial':                  60,
    },
    defaultMin: 30,
  },

  exclusions: {
    techNamePatterns: [
      /no tech assigned/i,
      /\bleo\b/i,
    ],
  },

  nh: {
    approvedTechNames: ['Alex Gray'],
    approvedTechIds:   [10068],
  },

  areaViability: { ...ROUTE_AREA_VIABILITY_DEFAULTS },

  areaBonus: {
    boundaryFalloffMiles: 5,
    new_hampshire: {
      mwf:  { latMax: 43.5 },
      tuth: { latMin: 43.5, lngEast: -71.0 },
      bonus: 8,
    },
    maine: {
      mwf:  { lngEast: -70.5 },
      tuth: { lngWest: -70.5 },
      bonus: 6,
    },
  },

  penalties: {
    timedRisk:    { high: 75, medium: 40, low: 15 },
    backtracking: { Severe: 25, High: 15, Moderate: 8, Low: 3, None: 0 },
    backtrackingBearing: {
      // deviation thresholds (degrees) and detour-ratio thresholds
      severe:   { dev: 135, detour: 1.5 },
      high:     { dev: 100, detour: 1.3 },
      moderate: { dev: 70,  detour: 1.2 },
      low:      { dev: 40,  detour: 1.1 },
      routeDirDetour: { dev: 120, detour: 1.3 },
    },
    insertionCandidate: {
      hardTimedConflict:     500,
      detourPerMile:         10,
      localProxPerMile:      5,
      timedRiskMedium:       50,
      timedRiskLow:          20,
      windowMiss:            15,
      clusterBonusPerQuality: 0.3,
      viabilityMiss:         10,
      backtrackingSeverity:  {
        Severe: 35, High: 20, Moderate: 10, Low: 4, None: 0,
      },
      backtrackingMultiplier: 5,
    },
  },

  // Phase 4: VRPTW objective coefficients
  vrptw: {
    alphaDetour:       10,
    betaSoftLate:       2.0,
    betaSoftEarly:      0.5,
    gammaTimedAnchor:   14.0,
    deltaDirection:    12,
    epsilonCluster:     1.5,
    zetaOvershoot:      5.0,
    timedToleranceMin:  0,
    dayEndHardSlackMin: 30,
  },
};

// Backwards-compatible re-export for existing callers
export const NH_CONFIG = SCORER_CONFIG.nh;

// Technicians permanently excluded from all Route Finder recommendations
const EXCLUDED_TECH_PATTERNS = SCORER_CONFIG.exclusions.techNamePatterns;

// Convenience aliases (keeps algorithm code readable without long config paths)
const W                   = SCORER_CONFIG.weights;
const AVG_SPEED_MPH       = SCORER_CONFIG.speed.avgMph;
const DAY_START_MIN       = SCORER_CONFIG.workday.dayStartMin;
const WORKDAY_END         = SCORER_CONFIG.workday.dayEndMin;
const DEFAULT_MAX_HOURS   = SCORER_CONFIG.workday.defaultMaxHours;
const CLUSTER_RADIUS_MILES = SCORER_CONFIG.thresholds.clusterRadiusMiles;
const GEO_ZERO_MILES      = SCORER_CONFIG.thresholds.geoZeroMiles;
const TRAVEL_ZERO_MILES   = SCORER_CONFIG.thresholds.travelZeroMiles;
const HOME_NEAR_MILES     = SCORER_CONFIG.thresholds.homeNearMiles;
const TIMED_WINDOW_MAX_MIN = SCORER_CONFIG.thresholds.timedWindowMaxMin;

function point(lat, lng) {
  return lat != null && lng != null ? { lat, lng } : null;
}

/** Road-based segment when travel context is available; otherwise haversine estimate. */
function travelSegment(fromLat, fromLng, toLat, toLng, travelCtx = null) {
  const origin = point(fromLat, fromLng);
  const destination = point(toLat, toLng);
  if (!origin || !destination) {
    return { distanceMiles: 0, travelMinutes: 0, provider: 'haversine', accuracy: 'estimated' };
  }
  if (travelCtx?.getSegment) {
    return travelCtx.getSegment(origin, destination);
  }
  const distanceMiles = haversine(fromLat, fromLng, toLat, toLng);
  return {
    distanceMiles,
    travelMinutes: travelMin(distanceMiles),
    provider: 'haversine',
    accuracy: 'estimated',
  };
}

function workloadScoreFromLabel(label) {
  switch (label) {
    case 'healthy': return 100;
    case 'near-capacity': return 75;
    case 'heavy': return 50;
    case 'avoid-if-possible': return 30;
    default: return 60;
  }
}

function normalizeServiceType(str) {
  return str?.toLowerCase().replace(/[^a-z0-9]+/g, '') ?? '';
}

// Build normalized lookup once at module load
const DURATION_LOOKUP = new Map(
  Object.entries(SCORER_CONFIG.durations.map).map(([k, v]) => [normalizeServiceType(k), v])
);

export function getDefaultDuration(serviceType) {
  return DURATION_LOOKUP.get(normalizeServiceType(serviceType))
    ?? SCORER_CONFIG.durations.defaultMin;
}

// ---------------------------------------------------------------------------
// Core math utilities (distance/drive via routeTravelTimeProvider)
// ---------------------------------------------------------------------------

// Compass bearing (degrees 0–360) from point A to point B
function bearing(lat1, lng1, lat2, lng2) {
  const toRad = d => (d * Math.PI) / 180;
  const dLng  = toRad(lng2 - lng1);
  const lat1R = toRad(lat1);
  const lat2R = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) -
            Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Minimum arc between two compass bearings (0–180)
function angularDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function fmtTime12h(min) {
  if (min == null) return null;
  const totalMin = Math.round(min);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function parseTimeStr(str) {
  if (str == null) return null;
  const parts = String(str).split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function parseWindowHalf(str) {
  const raw = String(str).trim();
  const mParts = raw.match(/^(\d{1,2})(?:\.(\d{1,2}))?$/);
  if (!mParts) return DAY_START_MIN;

  const h = Number(mParts[1]);
  let m = 0;
  if (mParts[2] != null) {
    const minuteText = mParts[2].padEnd(2, '0');
    m = Number(minuteText);
  }
  if (!Number.isFinite(h) || !Number.isFinite(m) || m >= 60) return DAY_START_MIN;
  const totalMin = h * 60 + m;
  return h >= 1 && h < 8 ? totalMin + 12 * 60 : totalMin;
}

function parseWindow(pref) {
  if (!pref || pref === 'AT') return { start: 480, end: WORKDAY_END };
  if (pref === 'AM') return { start: 480, end: 720 };
  if (pref === 'PM') return { start: 720, end: 1080 };
  const m = pref.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!m) return { start: 480, end: WORKDAY_END };
  return { start: parseWindowHalf(m[1]), end: parseWindowHalf(m[2]) };
}

function parseDurationCapacity(raw) {
  if (!raw) return { currentHours: 0, maxHours: DEFAULT_MAX_HOURS, remainingHours: DEFAULT_MAX_HOURS };
  const m = raw.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (!m) return { currentHours: 0, maxHours: DEFAULT_MAX_HOURS, remainingHours: DEFAULT_MAX_HOURS };
  const cur = parseFloat(m[1]);
  const max = parseFloat(m[2]);
  return { currentHours: cur, maxHours: max, remainingHours: Math.max(0, max - cur) };
}

function isTimedStop(stop) {
  const start = parseTimeStr(stop.startTime);
  const end   = parseTimeStr(stop.endTime);
  if (start == null || end == null) return false;
  return (end - start) <= TIMED_WINDOW_MAX_MIN;
}

function timedRiskLevel(violations) {
  if (!violations.length) return 'none';
  const maxLate = Math.max(...violations.map(v => v.lateness));
  if (maxLate <= 0) return 'none';
  if (maxLate > 15) return 'high';
  return 'medium';
}

function formatTimedWindowLabel(windowStart, windowEnd) {
  if (windowStart == null || windowEnd == null) return null;
  return `${fmtTime12h(windowStart)}–${fmtTime12h(windowEnd)}`;
}

function buildTimedAppointmentDetail(insertion, stops) {
  const hasTimedStops = stops.some(isTimedStop);
  const base = {
    timedConflictCustomerName: null,
    timedConflictWindow: null,
    projectedTimedArrival: null,
    timedConflictMinutesLate: null,
    timedConflictWarning: null,
    timedConflictFallback: false,
  };

  if (!hasTimedStops) {
    return {
      ...base,
      timedAppointmentStatus: 'none',
      timedAppointmentLabel: 'None',
    };
  }

  const primary = insertion.timedViolations?.[0];
  const risk = insertion.timedRisk;

  if (risk === 'high' || risk === 'medium') {
    const customerName = primary?.customerName ?? null;
    const windowLabel = formatTimedWindowLabel(primary?.windowStart, primary?.windowEnd);
    const projected = primary?.projectedArrival != null ? fmtTime12h(primary.projectedArrival) : null;
    const minutesLate = primary?.lateness ?? 0;
    const status = risk === 'high' ? 'conflict' : 'risk';
    let warning = customerName
      ? `Scheduling conflict: adding this stop may push ${customerName} outside their appointment window.`
      : 'Scheduling conflict: adding this stop may affect an existing timed appointment.';
    if (projected && primary?.windowEnd != null) {
      warning += ` Projected arrival: ${projected}. Window ends: ${fmtTime12h(primary.windowEnd)}.`;
    } else if (minutesLate > 0) {
      warning += ` This route may be ${minutesLate} minutes late to the next timed appointment.`;
    }

    return {
      ...base,
      timedAppointmentStatus: status,
      timedAppointmentLabel: 'Conflict risk',
      timedConflictCustomerName: customerName,
      timedConflictWindow: windowLabel,
      projectedTimedArrival: projected,
      timedConflictMinutesLate: minutesLate,
      timedConflictWarning: warning,
      timedConflictFallback: true,
    };
  }

  if (risk === 'low') {
    const buffer = insertion.minTimingBuffer;
    const nextTimed = insertion.beforeStop && isTimedStop(insertion.beforeStop)
      ? insertion.beforeStop
      : null;
    return {
      ...base,
      timedAppointmentStatus: 'risk',
      timedAppointmentLabel: 'Tight timing',
      timedConflictCustomerName: nextTimed?.customerName ?? null,
      timedConflictWindow: nextTimed
        ? formatTimedWindowLabel(parseTimeStr(nextTimed.startTime), parseTimeStr(nextTimed.endTime))
        : null,
      timedConflictWarning: buffer != null
        ? `Only ${buffer} minutes before the next timed appointment.`
        : 'Tight timing buffer before the next timed appointment.',
    };
  }

  return {
    ...base,
    timedAppointmentStatus: 'safe',
    timedAppointmentLabel: 'Safe',
    timedConflictWarning: insertion.minTimingBuffer != null && insertion.minTimingBuffer < 60
      ? `${insertion.minTimingBuffer}-minute buffer before next timed appointment.`
      : null,
  };
}

/**
 * Recommend AM or PM as the broad arrival window.
 *
 * Clear zones:
 *   < 11:00 AM (660) → AM
 *   ≥ 12:00 PM (720) → PM
 *
 * Border zone 11:00 AM–12:00 PM: resolve using route context —
 *   nearby AM vs PM stop counts, AM service load, and position in day.
 */
function suggestBroadWindow(arrivalMin, stops, leadLat, leadLng) {
  if (arrivalMin == null) return null;
  const BORDER_START = 660;  // 11:00 AM
  const NOON         = 720;  // 12:00 PM

  if (arrivalMin < BORDER_START) return 'AM';
  if (arrivalMin >= NOON)        return 'PM';

  // Border zone — use route context to decide
  const amStops = stops.filter(s => s.spotStartMinutes != null && s.spotStartMinutes < NOON);
  const pmStops = stops.filter(s => s.spotStartMinutes != null && s.spotStartMinutes >= NOON);

  // Nearby stops in each half
  const nearbyAM = amStops.filter(
    s => s.lat && s.lng && haversine(leadLat, leadLng, s.lat, s.lng) <= CLUSTER_RADIUS_MILES
  ).length;
  const nearbyPM = pmStops.filter(
    s => s.lat && s.lng && haversine(leadLat, leadLng, s.lat, s.lng) <= CLUSTER_RADIUS_MILES
  ).length;

  if (nearbyAM > nearbyPM) return 'AM';
  if (nearbyPM > nearbyAM) return 'PM';

  // Tiebreak: if AM block already carries > 3 hours of service and PM has room
  const amServiceLoad = amStops.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  if (amServiceLoad > 180 && pmStops.length > 0) return 'PM';

  // Final tiebreak: 11:00–11:30 → AM, 11:30–12:00 → PM
  return arrivalMin < 690 ? 'AM' : 'PM';
}

// ---------------------------------------------------------------------------
// Route area detection + day-of-week soft scoring
// ---------------------------------------------------------------------------

export function detectRouteArea(fullAddress) {
  if (!fullAddress) return 'general';
  const upper = fullAddress.toUpperCase();
  if (upper.includes('NEW HAMPSHIRE')) return 'new_hampshire';
  if (/\bMAINE\b/.test(upper))         return 'maine';
  return 'general';
}

function getRouteAreaDayBonus(routeArea, lat, lng, dayOfWeek) {
  const cfg = SCORER_CONFIG.areaBonus;
  const falloff = cfg.boundaryFalloffMiles;

  // Miles per degree (approximate at the given latitude)
  const milesPerDegLat = 69.0;
  const milesPerDegLng = 69.0 * Math.cos(lat * Math.PI / 180);

  // Linear taper: full bonus when ≥ falloff miles inside the zone,
  // proportional when 0–falloff miles inside, 0 when outside.
  function taper(bonus, distInsideMiles) {
    if (distInsideMiles <= 0) return 0;
    if (distInsideMiles >= falloff) return bonus;
    return Math.round(bonus * (distInsideMiles / falloff));
  }

  if (routeArea === 'new_hampshire') {
    const areaCfg = cfg.new_hampshire;
    const isMWF  = [1, 3, 5].includes(dayOfWeek);
    const isTuTh = [2, 4].includes(dayOfWeek);
    if (isMWF) {
      // South NH: lat < latMax (43.5)
      const distInside = (areaCfg.mwf.latMax - lat) * milesPerDegLat;
      return taper(areaCfg.bonus, distInside);
    }
    if (isTuTh) {
      // North NH (lat >= latMin) OR Seacoast (lng > lngEast)
      const distNorth = (lat - areaCfg.tuth.latMin) * milesPerDegLat;
      const distEast  = (lng - areaCfg.tuth.lngEast) * milesPerDegLng;
      return taper(areaCfg.bonus, Math.max(distNorth, distEast));
    }
  }

  if (routeArea === 'maine') {
    const areaCfg = cfg.maine;
    const isMWF  = [1, 3, 5].includes(dayOfWeek);
    const isTuTh = [2, 4].includes(dayOfWeek);
    if (isMWF) {
      // Coastal: lng > lngEast (-70.5)
      const distInside = (lng - areaCfg.mwf.lngEast) * milesPerDegLng;
      return taper(areaCfg.bonus, distInside);
    }
    if (isTuTh) {
      // Inland: lng <= lngWest (-70.5) → distInside = boundary - lng
      const distInside = (areaCfg.tuth.lngWest - lng) * milesPerDegLng;
      return taper(areaCfg.bonus, distInside);
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Route pre-optimization — nearest-neighbor + 2-opt with timed anchor locks
// ---------------------------------------------------------------------------

/**
 * Greedy nearest-neighbor ordering of stops starting from (fromLat, fromLng).
 */
function nearestNeighborOrder(stops, fromLat, fromLng) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return [...stops];

  const remaining = new Set(stops.map((_, i) => i));
  const result = [];
  let curLat = fromLat;
  let curLng = fromLng;

  while (remaining.size > 0) {
    let bestIdx = null;
    let bestDist = Infinity;
    for (const idx of remaining) {
      const s = stops[idx];
      if (!s.lat || !s.lng) continue;
      const d = haversine(curLat, curLng, s.lat, s.lng);
      if (d < bestDist) { bestIdx = idx; bestDist = d; }
    }
    if (bestIdx === null) {
      // Stops without coords — append remaining in original order
      for (const idx of remaining) result.push(stops[idx]);
      break;
    }
    result.push(stops[bestIdx]);
    curLat = stops[bestIdx].lat;
    curLng = stops[bestIdx].lng;
    remaining.delete(bestIdx);
  }

  return result;
}

/**
 * 2-opt improvement on a segment (no anchor crossing).
 * Reverses sub-segments that reduce total haversine distance.
 */
function twoOptImprove(stops) {
  if (stops.length < 4) return stops;
  let route = [...stops];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 60) {
    improved = false;
    iterations++;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 2; j < route.length; j++) {
        const a = route[i];
        const b = route[i + 1];
        const c = route[j];
        const d = j + 1 < route.length ? route[j + 1] : null;
        if (!a.lat || !b.lat || !c.lat) continue;
        const costBefore =
          haversine(a.lat, a.lng, b.lat, b.lng) +
          (d ? haversine(c.lat, c.lng, d.lat, d.lng) : 0);
        const costAfter =
          haversine(a.lat, a.lng, c.lat, c.lng) +
          (d ? haversine(b.lat, b.lng, d.lat, d.lng) : 0);
        if (costAfter < costBefore - 0.01) {
          route = [
            ...route.slice(0, i + 1),
            ...route.slice(i + 1, j + 1).reverse(),
            ...route.slice(j + 1),
          ];
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Simulate a route to build a timing map.
 * Returns an array of { stop, arrivalMin, departMin } for each stop in order.
 */
function simulateRouteTiming(stops, startLat, startLng, startTimeMin = 480, travelCtx = null) {
  const timeline = [];
  let curLat = startLat;
  let curLng = startLng;
  let curTime = startTimeMin;

  for (const stop of stops) {
    if (!stop.lat || !stop.lng) {
      timeline.push({ stop, arrivalMin: curTime, departMin: curTime + stop.durationMinutes });
      curTime += stop.durationMinutes;
      continue;
    }
    const drive = Math.ceil(travelSegment(curLat, curLng, stop.lat, stop.lng, travelCtx).travelMinutes);
    // Respect timed window: can't arrive before window start
    const windowStart = isTimedStop(stop) ? (parseTimeStr(stop.startTime) ?? 0) : 0;
    const arrival = Math.max(curTime + drive, windowStart);
    const depart  = arrival + stop.durationMinutes;
    timeline.push({ stop, arrivalMin: arrival, departMin: depart });
    curLat  = stop.lat;
    curLng  = stop.lng;
    curTime = depart;
  }

  return timeline;
}

/**
 * Full route pre-optimizer.
 *
 * Strategy:
 *   1. Identify timed anchors — these stay in time-sorted order.
 *   2. Divide the day into segments separated by anchors.
 *   3. Assign each non-timed stop to the segment whose time bracket best fits
 *      its original scheduled time.
 *   4. Within each segment, apply nearest-neighbor + 2-opt.
 *   5. Re-sequence: [seg0_optimized, anchor0, seg1_optimized, anchor1, ...]
 *
 * Stops without lat/lng are appended at the end unchanged.
 */
function optimizeRouteOrder(stops, startLoc, endLoc) {
  if (!stops || stops.length <= 2) return { stops: stops || [], wasOptimized: false };

  const hasStart = startLoc?.lat != null && startLoc?.lng != null;
  const hasEnd   = endLoc?.lat   != null && endLoc?.lng   != null;

  const withCoords    = stops.filter(s => s.lat && s.lng);
  const withoutCoords = stops.filter(s => !s.lat || !s.lng);

  if (withCoords.length <= 2) return { stops, wasOptimized: false };

  // Separate timed anchors from floating stops
  const anchors  = withCoords.filter(s => isTimedStop(s))
                              .sort((a, b) => a.spotStartMinutes - b.spotStartMinutes);
  const floaters = withCoords.filter(s => !isTimedStop(s));

  if (floaters.length === 0) {
    return { stops: [...anchors, ...withoutCoords], wasOptimized: false };
  }

  // Build segment boundaries
  // segments[i] covers the gap before anchors[i] (or before end for the last segment)
  const segments = [];
  let segStartLat = hasStart ? startLoc.lat : withCoords[0].lat;
  let segStartLng = hasStart ? startLoc.lng : withCoords[0].lng;
  let segTimeBefore = 480;

  for (let ai = 0; ai <= anchors.length; ai++) {
    const nextAnchor  = anchors[ai] ?? null;
    const segEndLat   = nextAnchor ? nextAnchor.lat : (hasEnd ? endLoc.lat   : segStartLat);
    const segEndLng   = nextAnchor ? nextAnchor.lng : (hasEnd ? endLoc.lng   : segStartLng);
    const segTimeEnd  = nextAnchor ? nextAnchor.spotStartMinutes : WORKDAY_END;

    segments.push({
      startLat: segStartLat, startLng: segStartLng,
      endLat:   segEndLat,   endLng:   segEndLng,
      timeBefore: segTimeBefore, timeEnd: segTimeEnd,
      floaters: [],
    });

    if (nextAnchor) {
      segStartLat   = nextAnchor.lat;
      segStartLng   = nextAnchor.lng;
      segTimeBefore = nextAnchor.spotStartMinutes + nextAnchor.durationMinutes;
    }
  }

  // Assign each floater to its best-fit segment
  for (const f of floaters) {
    const origTime = f.spotStartMinutes ?? 720;
    let bestSeg = segments.length - 1;
    for (let si = 0; si < segments.length; si++) {
      if (origTime >= segments[si].timeBefore && origTime <= segments[si].timeEnd) {
        bestSeg = si;
        break;
      }
    }
    segments[bestSeg].floaters.push(f);
  }

  // Optimize each segment
  const result = [];
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    if (seg.floaters.length > 0) {
      const nn = nearestNeighborOrder(seg.floaters, seg.startLat, seg.startLng);
      const optimized = twoOptImprove(nn);
      result.push(...optimized);
    }
    if (si < anchors.length) result.push(anchors[si]);
  }

  result.push(...withoutCoords);

  // Check if we actually changed the order using a stable stop identity hash
  // (appointmentId may be undefined on some stops, causing false-negatives)
  const stopHash = s =>
    `${s.lat?.toFixed(5)}|${s.lng?.toFixed(5)}|${s.customerName ?? ''}|${s.startTime ?? ''}`;
  const originalHash = stops.map(stopHash);
  const newHash      = result.map(stopHash);
  const wasOptimized = !originalHash.every((h, i) => h === newHash[i]);

  return { stops: result, wasOptimized };
}

// ---------------------------------------------------------------------------
// Overall route direction — bearing from start area to end area
// ---------------------------------------------------------------------------

function computeRouteDirectionBearing(stops, startLoc, endLoc) {
  if (!stops || stops.length === 0) return null;
  const withCoords = stops.filter(s => s.lat && s.lng);
  if (withCoords.length < 2) return null;

  const fromLat = startLoc?.lat ?? withCoords[0].lat;
  const fromLng = startLoc?.lng ?? withCoords[0].lng;
  const toLat   = endLoc?.lat   ?? withCoords[withCoords.length - 1].lat;
  const toLng   = endLoc?.lng   ?? withCoords[withCoords.length - 1].lng;

  if (haversine(fromLat, fromLng, toLat, toLng) < 0.5) return null; // start ≈ end
  return bearing(fromLat, fromLng, toLat, toLng);
}

// ---------------------------------------------------------------------------
// Bearing-based backtracking detection (replaces dot-product version)
// ---------------------------------------------------------------------------

function measureBacktracking(prev, newLat, newLng, next, routeDirectionBearing) {
  if (!prev || !next || !prev.lat || !next.lat) {
    return { backtracking: false, severity: 0, risk: 'None', detail: null };
  }

  const btCfg = SCORER_CONFIG.penalties.backtrackingBearing;

  const routeBearing = bearing(prev.lat, prev.lng, next.lat, next.lng);
  const newBearing   = bearing(prev.lat, prev.lng, newLat, newLng);
  const deviation    = angularDiff(routeBearing, newBearing);

  const dPrev = haversine(prev.lat, prev.lng, newLat, newLng);
  const dNext = haversine(newLat, newLng, next.lat, next.lng);
  const dDirect = haversine(prev.lat, prev.lng, next.lat, next.lng);
  const detourRatio = dDirect > 0.01 ? (dPrev + dNext) / dDirect : 1;

  // Also check against overall route direction for additional route-level penalty
  let routeDirPenalty = 0;
  if (routeDirectionBearing != null) {
    const dirDev = angularDiff(routeDirectionBearing, newBearing);
    if (dirDev > btCfg.routeDirDetour.dev && detourRatio > btCfg.routeDirDetour.detour) {
      routeDirPenalty = 1;
    }
  }

  let risk = 'None';
  let severity = 0;

  if (deviation > btCfg.severe.dev && detourRatio > btCfg.severe.detour) {
    risk = 'Severe'; severity = 3 + routeDirPenalty;
  } else if (deviation > btCfg.high.dev && detourRatio > btCfg.high.detour) {
    risk = 'High';   severity = 2 + routeDirPenalty;
  } else if (deviation > btCfg.moderate.dev && detourRatio > btCfg.moderate.detour) {
    risk = 'Moderate'; severity = 1 + routeDirPenalty;
  } else if (deviation > btCfg.low.dev && detourRatio > btCfg.low.detour) {
    risk = 'Low';    severity = 0.5;
  }

  const backtracking = severity > 0;

  let detail = null;
  if (risk === 'Severe' || risk === 'High') {
    detail = `${Math.round(deviation)}° off route direction — adds ${Math.round((detourRatio - 1) * 100)}% extra mileage`;
  } else if (risk === 'Moderate') {
    detail = `${Math.round(deviation)}° deviation from route bearing`;
  }

  return { backtracking, severity, risk, detail };
}

// ---------------------------------------------------------------------------
// Cluster quality — enhanced beyond raw count
// ---------------------------------------------------------------------------

function computeClusterQuality(stops, leadLat, leadLng) {
  const nearby = stops.filter(
    s => s.lat && s.lng && haversine(leadLat, leadLng, s.lat, s.lng) <= CLUSTER_RADIUS_MILES
  );

  if (nearby.length === 0) {
    return { count: 0, quality: 0, label: `No stops within ${CLUSTER_RADIUS_MILES} mi`, spreadMiles: null, isContiguous: false };
  }

  // Spread = average pairwise haversine between nearby stops
  let totalSpread = 0;
  let pairs = 0;
  for (let i = 0; i < nearby.length - 1; i++) {
    for (let j = i + 1; j < nearby.length; j++) {
      totalSpread += haversine(nearby[i].lat, nearby[i].lng, nearby[j].lat, nearby[j].lng);
      pairs++;
    }
  }
  const spreadMiles = pairs > 0 ? Math.round((totalSpread / pairs) * 10) / 10 : 0;

  // Contiguous check — are the nearby stops consecutive in route order?
  const nearbyOrders = nearby.map(s => s.routeOrder ?? 999).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < nearbyOrders.length - 1; i++) {
    maxGap = Math.max(maxGap, nearbyOrders[i + 1] - nearbyOrders[i]);
  }
  const isContiguous = maxGap <= 2;

  // Quality: more stops, tighter spread, contiguous = higher
  const quality = Math.round(
    (nearby.length * 10) / (1 + spreadMiles) * (isContiguous ? 1.3 : 1.0)
  );

  let label;
  if (nearby.length >= 4) {
    label = `Strong cluster — ${nearby.length} stops within ${CLUSTER_RADIUS_MILES} mi` +
            (spreadMiles > 0 ? `, ${spreadMiles} mi spread` : '') +
            (isContiguous ? ' (contiguous)' : '');
  } else if (nearby.length === 3) {
    label = `Moderate cluster — 3 stops within ${CLUSTER_RADIUS_MILES} mi` +
            (spreadMiles > 0 ? `, ${spreadMiles} mi spread` : '');
  } else if (nearby.length === 2) {
    label = `2 nearby stops within ${CLUSTER_RADIUS_MILES} mi` +
            (spreadMiles > 0 ? ` (${spreadMiles} mi apart)` : '');
  } else {
    label = `1 nearby stop within ${CLUSTER_RADIUS_MILES} mi`;
  }

  return { count: nearby.length, quality, label, spreadMiles, isContiguous };
}

// ---------------------------------------------------------------------------
// Start/end location fit label
// ---------------------------------------------------------------------------

function buildStartEndFit(tech, leadLat, leadLng, insertionArrivalMin) {
  const startLoc = tech.startLocation;
  const endLoc   = tech.endLocation;

  const hasStart = startLoc?.lat != null && startLoc?.lng != null;
  const hasEnd   = endLoc?.lat   != null && endLoc?.lng   != null;

  if (!hasStart && !hasEnd) return 'Neutral — no start/end location data';

  const distToStart = hasStart
    ? Math.round(haversine(leadLat, leadLng, startLoc.lat, startLoc.lng) * 10) / 10
    : null;
  const distToEnd = hasEnd
    ? Math.round(haversine(leadLat, leadLng, endLoc.lat, endLoc.lng) * 10) / 10
    : null;

  const isAM = insertionArrivalMin != null && insertionArrivalMin < 720;
  const isPM = insertionArrivalMin != null && insertionArrivalMin >= 720;

  if (distToStart !== null && distToStart <= HOME_NEAR_MILES && isAM) {
    return `Strong AM fit — ${distToStart} mi from tech start location`;
  }
  if (distToEnd !== null && distToEnd <= HOME_NEAR_MILES && isPM) {
    return `Strong PM fit — ${distToEnd} mi from tech end location`;
  }
  if (distToStart !== null && distToStart <= HOME_NEAR_MILES) {
    return `Near tech start (${distToStart} mi) — good morning candidate`;
  }
  if (distToEnd !== null && distToEnd <= HOME_NEAR_MILES) {
    return `Near tech end (${distToEnd} mi) — good afternoon candidate`;
  }

  // Show proximity even when not strongly near
  if (distToStart !== null && distToEnd !== null) {
    const closer = distToStart < distToEnd ? `start (${distToStart} mi)` : `end (${distToEnd} mi)`;
    return `Neutral — closer to tech ${closer}`;
  }

  return 'Neutral';
}

// ---------------------------------------------------------------------------
// Optimization confidence
// ---------------------------------------------------------------------------

function computeOptimizationConfidence(stops, insertion) {
  if (!stops || stops.length === 0) return 'Low';
  const withCoords = stops.filter(s => s.lat && s.lng);
  const coordCoverage = withCoords.length / stops.length;
  if (coordCoverage < 0.6) return 'Low';

  const hasGoodData = insertion && insertion.detourMiles != null;
  if (!hasGoodData) return 'Low';

  // High confidence: good coord coverage + clear insertion point + not end-biased
  if (coordCoverage >= 0.9 && insertion.localProximityMiles < 3) {
    return 'High';
  }
  if (coordCoverage >= 0.75) return 'Medium';
  return 'Low';
}

// ---------------------------------------------------------------------------
// Timed safety label
// ---------------------------------------------------------------------------

function buildTimedSafetyLabel(insertion) {
  const detail = insertion.timedAppointmentDetail;
  if (detail?.timedAppointmentLabel) return detail.timedAppointmentLabel;
  const { timedRisk, timedViolations, minTimingBuffer } = insertion;
  if (timedRisk === 'high' || timedRisk === 'medium') {
    const v = timedViolations?.[0];
    if (v) return `Conflict risk — ${v.customerName}`;
    return 'Conflict risk';
  }
  if (timedRisk === 'low') {
    if (minTimingBuffer != null) return `Tight timing — ${minTimingBuffer} min buffer`;
    return 'Tight timing';
  }
  if (minTimingBuffer != null && minTimingBuffer < 60) {
    return `Safe — ${minTimingBuffer}-minute buffer`;
  }
  return 'Safe';
}

// ---------------------------------------------------------------------------
// Home proximity (existing logic, unchanged)
// ---------------------------------------------------------------------------

function measureHomeProximity(tech, leadLat, leadLng) {
  const stops = tech.stops.filter(s => s.lat && s.lng);
  if (stops.length === 0) return null;

  const first = stops[0];
  const last  = stops[stops.length - 1];

  const distToStart = Math.round(haversine(leadLat, leadLng, first.lat, first.lng) * 10) / 10;
  const distToEnd   = Math.round(haversine(leadLat, leadLng, last.lat,  last.lng)  * 10) / 10;

  const nearby    = stops.filter(s => haversine(leadLat, leadLng, s.lat, s.lng) <= HOME_NEAR_MILES);
  const nearbyAM  = nearby.filter(s => s.spotStartMinutes < 720).length;
  const nearbyPM  = nearby.filter(s => s.spotStartMinutes >= 720).length;

  const nearRouteStart = distToStart <= HOME_NEAR_MILES;
  const nearRouteEnd   = distToEnd   <= HOME_NEAR_MILES;

  const timingSuggestion =
    nearRouteEnd   && nearbyPM > nearbyAM ? 'PM' :
    nearRouteStart && nearbyAM > nearbyPM ? 'AM' :
    null;

  return {
    distToRouteStart: distToStart,
    distToRouteEnd:   distToEnd,
    nearRouteStart,
    nearRouteEnd,
    nearbyAmStops: nearbyAM,
    nearbyPmStops: nearbyPM,
    timingSuggestion,
  };
}

// ---------------------------------------------------------------------------
// VRPTW insertion engine (Phase 4)
//
// Replaces the heuristic candidate-score ranking with a principled
// cost-minimization objective subject to hard constraints.
//
// Objective (lower = better):
//   cost(i) = α·detour_mi
//           + β·max(0, arrival_i − w_b) + β2·max(0, w_a − arrival_i)
//           + γ·Σ lateness_k for timed anchors k > i
//           + δ·routeDirectionPenalty(i)
//           - ε·localClusterBenefit(i)
//
// Hard constraints (cost = +Infinity):
//   - Any timed anchor projected past window_b + timedToleranceMin
//   - durationMin > remainingHours * 60 (handled upstream via isOverCapacity)
// ---------------------------------------------------------------------------

function vrptwInsertion(
  stops, leadLat, leadLng, durationMin, prefWindow,
  startLoc, endLoc, routeDirectionBearing, clusterData, cfg, travelCtx = null
) {
  if (stops.length === 0) return null;

  const v = cfg.vrptw;
  const hasStart = startLoc?.lat != null && startLoc?.lng != null;
  const hasEnd   = endLoc?.lat   != null && endLoc?.lng   != null;

  // Forward-sweep: propagate arrivals through the route after inserting at slot i.
  // Returns { arrivals, projectedEnd, timedViolations, timedLatenessSum } or null if hard-fail.
  function propagate(insertIdx) {
    const arrivals = [];
    let cur = hasStart ? { lat: startLoc.lat, lng: startLoc.lng } : (stops[0] ?? null);
    let curTime = DAY_START_MIN;

    // Build the route in insertion order
    for (let k = 0; k <= stops.length; k++) {
      const isNew = (k === insertIdx + 1); // insert new stop here (insertIdx=-1 → k=0)
      const stop = isNew ? { lat: leadLat, lng: leadLng, durationMinutes: durationMin, _isNew: true }
                         : stops[k > insertIdx + 1 ? k - 1 : k]; // stops after insertion shift

      if (!stop) break;
      if (!stop.lat || !stop.lng) {
        arrivals.push({ stop, arrivalMin: curTime, isNew });
        curTime += stop.durationMinutes;
        continue;
      }

      const drive = travelSegment(
        cur?.lat ?? stop.lat, cur?.lng ?? stop.lng, stop.lat, stop.lng, travelCtx,
      ).travelMinutes;
      let arrival = curTime + drive;

      // Respect timed window start for non-new stops
      if (!isNew && isTimedStop(stop)) {
        const ws = parseTimeStr(stop.startTime);
        if (ws != null) arrival = Math.max(arrival, ws);
      }

      arrivals.push({ stop, arrivalMin: arrival, isNew });
      curTime = arrival + stop.durationMinutes;
      cur = stop;
    }

    // Travel to endLoc after last stop
    const lastArr = arrivals[arrivals.length - 1];
    const endTravel = (hasEnd && lastArr?.stop?.lat && lastArr?.stop?.lng)
      ? travelSegment(lastArr.stop.lat, lastArr.stop.lng, endLoc.lat, endLoc.lng, travelCtx).travelMinutes
      : 0;
    const projectedEnd = (lastArr?.arrivalMin ?? DAY_START_MIN) + (lastArr?.stop?.durationMinutes ?? 0) + endTravel;

    // Timed violations among existing stops
    const timedViolations = [];
    let timedLatenessSum = 0;
    for (const { stop, arrivalMin, isNew } of arrivals) {
      if (isNew || !isTimedStop(stop)) continue;
      const windowEnd = parseTimeStr(stop.endTime);
      if (windowEnd == null) continue;
      const lateness = Math.max(0, arrivalMin - windowEnd);
      if (lateness > v.timedToleranceMin) {
        const windowStart = parseTimeStr(stop.startTime);
        timedViolations.push({ stop, arrivalMin, windowStart, windowEnd, lateness });
      }
      timedLatenessSum += lateness;
    }

    return { arrivals, projectedEnd, timedViolations, timedLatenessSum };
  }

  const candidates = [];

  for (let insertIdx = -1; insertIdx < stops.length; insertIdx++) {
    const result = propagate(insertIdx);
    if (result === null) continue; // hard constraint violated

    const { arrivals, projectedEnd, timedViolations, timedLatenessSum } = result;
    const newArrEntry = arrivals.find(e => e.isNew);
    if (!newArrEntry) continue;

    const arrivalMin = newArrEntry.arrivalMin;
    const afterStop  = insertIdx >= 0 ? stops[insertIdx] : null;
    const beforeStop = insertIdx + 1 < stops.length ? stops[insertIdx + 1] : null;

    // Detour miles
    const prevLat = afterStop?.lat ?? (hasStart ? startLoc.lat : (stops[0]?.lat ?? leadLat));
    const prevLng = afterStop?.lng ?? (hasStart ? startLoc.lng : (stops[0]?.lng ?? leadLng));
    const nextLat = beforeStop?.lat ?? (hasEnd ? endLoc.lat : (stops[stops.length - 1]?.lat ?? leadLat));
    const nextLng = beforeStop?.lng ?? (hasEnd ? endLoc.lng : (stops[stops.length - 1]?.lng ?? leadLng));
    const segPN = travelSegment(prevLat, prevLng, leadLat, leadLng, travelCtx);
    const segNX = travelSegment(leadLat, leadLng, nextLat, nextLng, travelCtx);
    const segPX = travelSegment(prevLat, prevLng, nextLat, nextLng, travelCtx);
    const dPN = segPN.distanceMiles;
    const dNX = segNX.distanceMiles;
    const dPX = segPX.distanceMiles;
    const detourMiles = Math.max(0, dPN + dNX - dPX);

    // Window cost
    const windowCostLate  = v.betaSoftLate  * Math.max(0, arrivalMin - prefWindow.end);
    const windowCostEarly = v.betaSoftEarly * Math.max(0, prefWindow.start - arrivalMin);

    // Timed anchor cost
    const timedAnchorCost = v.gammaTimedAnchor * timedLatenessSum;

    // Route direction cost
    let directionCost = 0;
    if (afterStop?.lat && beforeStop?.lat && routeDirectionBearing != null) {
      const bt = measureBacktracking(afterStop, leadLat, leadLng, beforeStop, routeDirectionBearing);
      directionCost = v.deltaDirection * bt.severity;
    }

    const adjacentClusterQuality = [afterStop, beforeStop]
      .filter(s => s?.lat && s?.lng && haversine(leadLat, leadLng, s.lat, s.lng) <= cfg.thresholds.clusterRadiusMiles)
      .reduce((sum, s) => {
        const miles = haversine(leadLat, leadLng, s.lat, s.lng);
        return sum + Math.max(0, cfg.thresholds.clusterRadiusMiles - miles);
      }, 0);
    const clusterBenefit = v.epsilonCluster * adjacentClusterQuality;

    const newDepartMin = arrivalMin + durationMin;
    const nextTimed = arrivals.find(e => !e.isNew && isTimedStop(e.stop) && e.arrivalMin >= arrivalMin);
    const minTimingBuffer = nextTimed ? Math.round(nextTimed.arrivalMin - newDepartMin) : null;

    const totalCost = v.alphaDetour * detourMiles
      + windowCostLate + windowCostEarly
      + timedAnchorCost
      + directionCost
      - clusterBenefit;

    // Re-use legacy backtracking output for ResultCard fields
    const bt = (afterStop?.lat && beforeStop?.lat)
      ? measureBacktracking(afterStop, leadLat, leadLng, beforeStop, routeDirectionBearing)
      : { backtracking: false, severity: 0, risk: 'None', detail: null };

    const localProxMiles = Math.round(Math.min(dPN, dNX) * 10) / 10;
    const addedDriveMinutes = Math.max(0, Math.round(segPN.travelMinutes + segNX.travelMinutes - segPX.travelMinutes));

    candidates.push({
      _vrptwCost:           totalCost,
      afterIndex:           insertIdx,
      afterStop,
      beforeStop,
      estimatedArrivalMin:  Math.round(arrivalMin),
      detourMiles:          Math.round(detourMiles * 10) / 10,
      localProximityMiles:  localProxMiles,
      gapAvailableMin:      beforeStop ? beforeStop.spotStartMinutes - arrivalMin : null,
      viable:               true, // hard constraints already filtered
      backtracking:         bt.backtracking,
      backtrackingRisk:     bt.risk,
      backtrackingSeverity: bt.severity,
      backtrackingDetail:   bt.detail,
      delayAdded:           0, // VRPTW models delay in cost, not as a separate field
      timedViolations:      timedViolations.map(v => ({
        customerName:     v.stop.customerName,
        originalArrival:  v.stop.spotStartMinutes,
        projectedArrival: v.arrivalMin,
        windowStart:      v.windowStart,
        windowEnd:        v.windowEnd,
        lateness:         v.lateness,
      })),
      timedRisk:            timedViolations.length
        ? timedRiskLevel(timedViolations)
        : (minTimingBuffer != null && minTimingBuffer < 30 ? 'low' : 'none'),
      minTimingBuffer,
      addedDriveMinutes,
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= cfg.workday.dayEndMin,
      clusterQuality:       clusterData.quality,
    });
  }

  if (candidates.length === 0) return null;

  // Pick minimum VRPTW cost
  candidates.sort((a, b) => a._vrptwCost - b._vrptwCost);
  return { best: candidates[0], clusterData };
}

// ---------------------------------------------------------------------------
// Route smoothness label
// ---------------------------------------------------------------------------

function getRouteSmoothness(insertion) {
  if (!insertion) return null;
  if (insertion.timedRisk === 'high') return 'Difficult fit';
  if (insertion.timedRisk === 'medium') return 'Some disruption';
  if (insertion.backtrackingRisk === 'High' || insertion.backtrackingRisk === 'Severe') return 'Some disruption';
  if (insertion.backtrackingRisk === 'Moderate' || insertion.timedRisk === 'low') return 'Minor adjustment';
  if (!insertion.viable) return 'Tight gap';
  return 'Smooth fit';
}

// ---------------------------------------------------------------------------
// Rich reason builder
// ---------------------------------------------------------------------------

function buildReason({
  insertion, clusterData, techName, totalStops, homeProximity,
  wasOptimized, startEndFit, routeDirectionBearing, lead, routeDateLabel,
}) {
  const parts = [];
  const dayPrefix = routeDateLabel ? `${routeDateLabel}: ` : '';
  const travelNote = defaultTravelProvider.getProviderAccuracy() === 'estimated'
    ? ' Drive time is estimated from straight-line distance.'
    : '';

  if (lead?.customerName) {
    parts.push(`${techName} is the best fit${routeDateLabel ? ` for ${routeDateLabel}` : ''} for ${lead.customerName}`);
  }

  // Closest stop proximity
  if (insertion.localProximityMiles <= CLUSTER_RADIUS_MILES) {
    const prevName = insertion.afterStop?.customerName;
    const nextName = insertion.beforeStop?.customerName;
    const ref = prevName || nextName;
    if (ref) {
      parts.push(
        `${techName} will be near ${ref} ` +
        `(${insertion.localProximityMiles} mi away) when this stop would be served`
      );
    }
  }

  // Insertion position context
  if (insertion.afterIndex === -1) {
    parts.push(`placed before the first stop — adds ${insertion.detourMiles} mi`);
  } else if (insertion.afterIndex >= totalStops - 1) {
    if (clusterData.count > 0) {
      parts.push(
        `placed after the last stop — mid-route cluster exists but timing or geometry ` +
        `prevented insertion there; adds ${insertion.detourMiles} mi from route end`
      );
    } else {
      parts.push(`placed after the last stop — adds ${insertion.detourMiles} mi`);
    }
  } else {
    parts.push(
      `fits between stop ${insertion.afterIndex + 1} and stop ${insertion.afterIndex + 2} ` +
      `of ${totalStops} — adds ${insertion.detourMiles} mi and ${insertion.addedDriveMinutes} min drive`
    );
  }

  // Cluster
  if (clusterData.count >= 2) {
    parts.push(clusterData.label.toLowerCase());
  }

  // Backtracking
  if (insertion.backtrackingRisk === 'Severe' || insertion.backtrackingRisk === 'High') {
    parts.push(`backtracking risk is ${insertion.backtrackingRisk.toLowerCase()}${insertion.backtrackingDetail ? ` — ${insertion.backtrackingDetail}` : ''}`);
  } else if (insertion.backtrackingRisk === 'None') {
    parts.push('no backtracking');
  }

  // Timed safety
  if (insertion.timedRisk === 'none') {
    if (insertion.minTimingBuffer != null && insertion.minTimingBuffer < 60) {
      parts.push(`timed appointments safe (${insertion.minTimingBuffer}-min buffer)`);
    } else {
      parts.push('no timed appointments affected');
    }
  } else if (insertion.timedRisk === 'low') {
    parts.push(`timed appointment risk is low${insertion.minTimingBuffer != null ? ` (${insertion.minTimingBuffer}-min buffer)` : ''}`);
  } else if (insertion.timedRisk === 'medium' || insertion.timedRisk === 'high') {
    const v = insertion.timedViolations?.[0];
    if (v) {
      parts.push(
        `timed appointment conflict — ${v.customerName} may be ${v.lateness} min past window`,
      );
    } else {
      parts.push('timed appointment conflict risk');
    }
  }

  // Route optimization note
  if (wasOptimized) {
    parts.push(
      'route was internally optimized before this recommendation — ' +
      'this placement should remain valid once the office optimizes the day'
    );
  }

  // Start/end fit
  if (startEndFit && !startEndFit.startsWith('Neutral')) {
    parts.push(startEndFit.toLowerCase());
  }

  let text = parts
    .map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)
    .join('. ')
    .replace(/\.\s*$/, '');

  if (lead?.durationConfidence === 'custom' || lead?.durationConfidence === 'estimated') {
    text += `. Service duration (${lead.durationMinutes} min) is ${lead.durationConfidence === 'custom' ? 'custom' : 'estimated'}`;
  }

  if (travelNote) text += `.${travelNote}`;

  return (dayPrefix + text).replace(/^\s+/, '') + (text.endsWith('.') ? '' : '.');
}

// ---------------------------------------------------------------------------
// Per-route scorer
// ---------------------------------------------------------------------------

function scoreRoute(tech, lead, prefWindow, routingCtx = {}, cfg = SCORER_CONFIG) {
  const { routeArea = 'general', dayOfWeek = null, travelCtx = null } = routingCtx;
  const allStops = tech.stops.filter(s => s.lat && s.lng);
  if (allStops.length === 0) return null;

  const durationMeta = enrichStopsWithDurations(allStops);
  const enrichedStops = durationMeta.stops;
  const workload = assessRouteWorkload(tech, enrichedStops);
  const durationMin = lead.durationMinutes ?? getDefaultDuration(lead.serviceType);

  // ── Step 1: internally optimize the route ────────────────────────────────
  const startLoc = tech.startLocation;
  const endLoc   = tech.endLocation;
  const { stops: orderedStops, wasOptimized } = optimizeRouteOrder(enrichedStops, startLoc, endLoc);

  // ── Step 1b: rebuild timing from 8 AM for the optimized order ────────────
  // All techs start at 8 AM. Rebuilding spotStartMinutes from DAY_START_MIN
  // gives accurate arrival estimates regardless of whether FieldRoutes has
  // already optimized the schedule.
  const hasStartLoc = startLoc?.lat != null && startLoc?.lng != null;
  const simFromLat  = hasStartLoc ? startLoc.lat : (orderedStops[0]?.lat ?? lead.lat);
  const simFromLng  = hasStartLoc ? startLoc.lng : (orderedStops[0]?.lng ?? lead.lng);
  const timeline    = simulateRouteTiming(orderedStops, simFromLat, simFromLng, DAY_START_MIN, travelCtx);
  const stops       = orderedStops.map((stop, i) => ({
    ...stop,
    spotStartMinutes: timeline[i]?.arrivalMin ?? stop.spotStartMinutes ?? DAY_START_MIN,
  }));

  // ── Step 2: compute overall route direction bearing ───────────────────────
  const routeDirectionBearing = computeRouteDirectionBearing(stops, startLoc, endLoc);

  // ── Step 3: cluster quality ───────────────────────────────────────────────
  const clusterData = computeClusterQuality(stops, lead.lat, lead.lng);

  // ── Step 4: closest stop ──────────────────────────────────────────────────
  const stopsWithDist = stops
    .map((s, i) => ({ stop: s, idx: i, dist: haversine(lead.lat, lead.lng, s.lat, s.lng) }))
    .sort((a, b) => a.dist - b.dist);
  const closestStopData = stopsWithDist[0] ?? null;
  const closestStop = closestStopData ? {
    customerName:  closestStopData.stop.customerName ?? null,
    address:       closestStopData.stop.address ?? null,
    distanceMiles: Math.round(closestStopData.dist * 10) / 10,
    scheduledTime: fmtTime12h(closestStopData.stop.spotStartMinutes),
    stopIndex:     closestStopData.idx + 1,
  } : null;

  const minDist  = closestStopData?.dist ?? Infinity;
  // Exponential decay: score = 100·exp(-dist / scale). Gentler than linear —
  // never punishes a distant-but-viable route down to 0.
  const geoScore = Math.round(100 * Math.exp(-minDist / GEO_ZERO_MILES));

  // ── Step 5: find best insertion in the optimized route ────────────────────
  const insertionResult = vrptwInsertion(
    stops, lead.lat, lead.lng, durationMin, prefWindow,
    startLoc, endLoc, routeDirectionBearing, clusterData, cfg, travelCtx,
  );
  const { best: insertion, clusterData: insertionCluster } = insertionResult ?? {};

  if (!insertion) return null;

  // ── Step 6: compute scores ────────────────────────────────────────────────
  const travelScore = Math.round(100 * Math.exp(-insertion.detourMiles / TRAVEL_ZERO_MILES));

  // Window score
  const homeProximity = measureHomeProximity(tech, lead.lat, lead.lng);
  let windowScore = 0;
  const arr  = insertion.estimatedArrivalMin;
  const done = arr + durationMin;
  if (arr >= prefWindow.start && done <= prefWindow.end) windowScore = 100;
  else if (arr < prefWindow.end && done > prefWindow.start) windowScore = 50;
  if (homeProximity?.timingSuggestion) {
    const pref = lead.timeWindowPreference;
    const fits =
      (homeProximity.timingSuggestion === 'AM' && (pref === 'AM' || pref === 'AT')) ||
      (homeProximity.timingSuggestion === 'PM' && (pref === 'PM' || pref === 'AT'));
    if (fits) windowScore = Math.min(100, windowScore + 15);
  }

  const cap           = parseDurationCapacity(tech.routeDurationCapacityRaw);
  const capacityScore = cap.maxHours > 0
    ? Math.min(100, Math.max(0, (cap.remainingHours / cap.maxHours) * 100))
    : 50;
  const isOverCapacity = cap.remainingHours < durationMin / 60;

  const workloadScore = workloadScoreFromLabel(workload.workloadLabel);
  const projectedServiceMinutes = workload.currentServiceMinutes + durationMin;
  const maxServiceMinutes = cap.maxHours > 0 ? cap.maxHours * 60 : null;
  const serviceDurationScore = maxServiceMinutes
    ? Math.min(100, Math.max(0, ((maxServiceMinutes - projectedServiceMinutes) / maxServiceMinutes) * 100))
    : 50;

  const localProxMiles = insertion.localProximityMiles;
  const insertionProximityScore = Math.round(100 * Math.exp(-localProxMiles / GEO_ZERO_MILES));

  let total = Math.round(
    geoScore            * cfg.weights.geo            +
    travelScore         * cfg.weights.travel         +
    windowScore         * cfg.weights.window         +
    workloadScore       * (cfg.weights.workload ?? 0) +
    serviceDurationScore * (cfg.weights.serviceDuration ?? 0)
  );

  total -= workload.workloadPenalty;

  // Penalties — timed appointment risk only; EOD is no longer a scoring constraint
  const timedPen = cfg.penalties.timedRisk;
  if (insertion.timedRisk === 'high')   total -= timedPen.high;
  if (insertion.timedRisk === 'medium') total -= timedPen.medium;
  if (insertion.timedRisk === 'low')    total -= timedPen.low;

  // Backtracking penalty (bearing-based)
  const btPenalties = cfg.penalties.backtracking;
  total -= btPenalties[insertion.backtrackingRisk] ?? 0;

  // Cluster quality bonus
  if (insertionCluster.count > 0) total += Math.min(10, Math.round(insertionCluster.quality * 0.2));

  // End-of-route bias penalty when a cluster exists
  if (insertion.afterIndex === stops.length - 1 && clusterData.count > 0) total -= 8;

  total = Math.max(0, total);

  // Hard capacity gate: route cannot absorb this lead → floor score to 0
  if (isOverCapacity) total = 0;

  // Route area / day-of-week bonus
  const routeAreaBonus = dayOfWeek !== null
    ? getRouteAreaDayBonus(routeArea, lead.lat, lead.lng, dayOfWeek)
    : 0;
  if (routeAreaBonus > 0) total = Math.min(100, total + routeAreaBonus);

  const areaViability = assessAreaViability({
    tech,
    lead,
    stops,
    insertion,
    cfg: cfg.areaViability ?? ROUTE_AREA_VIABILITY_DEFAULTS,
  });
  const areaScoreAdj = getAreaViabilityScoreAdjustments(
    areaViability,
    cfg.areaViability ?? ROUTE_AREA_VIABILITY_DEFAULTS,
  );
  total += areaScoreAdj.bonus;
  total -= areaScoreAdj.penalty;
  total = Math.min(100, Math.max(0, total));

  // ── Step 7: build rich output ─────────────────────────────────────────────
  // Broad AM/PM recommendation — route-context aware at the 11 AM–noon border
  const suggestedWindow = suggestBroadWindow(insertion.estimatedArrivalMin, stops, lead.lat, lead.lng);

  const startEndFit = buildStartEndFit(tech, lead.lat, lead.lng, insertion.estimatedArrivalMin);
  const optimizationConfidence = computeOptimizationConfidence(stops, insertion);
  const routeSmoothness = getRouteSmoothness(insertion);

  const minTimingBufferMin   = insertion.minTimingBuffer ?? null;
  const minTimingBufferLabel = minTimingBufferMin === null ? null
    : minTimingBufferMin < 0 ? null
    : `${minTimingBufferMin} min before next timed appt`;

  // Insertion position label
  let insertionPositionLabel;
  if (insertion.afterIndex === -1) {
    insertionPositionLabel = `Before stop 1 of ${stops.length}`;
  } else if (insertion.afterIndex === stops.length - 1) {
    insertionPositionLabel = `After stop ${stops.length} of ${stops.length} (end of route)`;
  } else {
    insertionPositionLabel = `After stop ${insertion.afterIndex + 1} of ${stops.length}`;
  }

  // Full address labels for insert-after / insert-before
  const insertAfterLabel = insertion.afterStop
    ? [insertion.afterStop.customerName, insertion.afterStop.address]
        .filter(Boolean).join(' — ') +
        (insertion.afterStop.spotStartMinutes != null
          ? ` (${fmtTime12h(insertion.afterStop.spotStartMinutes)})`
          : '')
    : null;

  const insertBeforeLabel = insertion.beforeStop
    ? [insertion.beforeStop.customerName, insertion.beforeStop.address]
        .filter(Boolean).join(' — ') +
        (insertion.beforeStop.spotStartMinutes != null
          ? ` (${fmtTime12h(insertion.beforeStop.spotStartMinutes)})`
          : '') +
        (isTimedStop(insertion.beforeStop) ? ' ⏱ timed' : '')
    : null;

  const prevStop = insertion.afterStop ? {
    customerName:     insertion.afterStop.customerName,
    address:          insertion.afterStop.address,
    scheduledArrival: fmtTime12h(insertion.afterStop.spotStartMinutes),
    isTimed:          isTimedStop(insertion.afterStop),
  } : null;

  const nextStop = insertion.beforeStop ? {
    customerName:     insertion.beforeStop.customerName,
    address:          insertion.beforeStop.address,
    scheduledArrival: fmtTime12h(insertion.beforeStop.spotStartMinutes),
    isTimed:          isTimedStop(insertion.beforeStop),
    windowLabel:      isTimedStop(insertion.beforeStop)
      ? `${fmtTime12h(parseTimeStr(insertion.beforeStop.startTime))} – ${fmtTime12h(parseTimeStr(insertion.beforeStop.endTime))}`
      : null,
  } : null;

  const routeDateLabel = lead.date
    ? new Date(`${lead.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
    : null;

  const reason = buildReason({
    insertion,
    clusterData: insertionCluster,
    techName: tech.techName,
    totalStops: stops.length,
    homeProximity,
    wasOptimized,
    startEndFit,
    routeDirectionBearing,
    lead,
    routeDateLabel,
  });

  // EOD label — informational only, not a rejection
  const eodLabel = fmtTime12h(insertion.projectedRouteEnd)
    ? `Est. done by ${fmtTime12h(insertion.projectedRouteEnd)}`
    : null;

  const timedAppointmentDetail = buildTimedAppointmentDetail(insertion, stops);
  const routeStops = buildRouteStopsDisplay(stops, timeline, insertion, lead, tech);
  const currentServiceMin = workload.currentServiceMinutes;
  const totalServiceMin = projectedServiceMinutes;
  let currentDriveMin = 0;
  let totalDriveMin = 0;
  for (let i = 0; i < timeline.length; i++) {
    const fromLat = i === 0 ? simFromLat : timeline[i - 1].stop.lat;
    const fromLng = i === 0 ? simFromLng : timeline[i - 1].stop.lng;
    const s = timeline[i].stop;
    if (s.lat && s.lng) {
      currentDriveMin += travelSegment(fromLat, fromLng, s.lat, s.lng, travelCtx).travelMinutes;
    }
  }
  totalDriveMin = currentDriveMin + (insertion.addedDriveMinutes ?? 0);

  const homeToFirstStopDriveMinutes = hasStartLoc && stops[0]?.lat
    ? Math.ceil(travelSegment(startLoc.lat, startLoc.lng, stops[0].lat, stops[0].lng, travelCtx).travelMinutes)
    : null;
  const lastScheduledStop = stops[stops.length - 1];
  const lastToHomeDriveMinutes = endLoc?.lat && lastScheduledStop?.lat
    ? Math.ceil(travelSegment(
      lastScheduledStop.lat, lastScheduledStop.lng, endLoc.lat, endLoc.lng, travelCtx,
    ).travelMinutes)
    : null;
  const projectedFullDayMinutes = Math.round(
    (homeToFirstStopDriveMinutes ?? 0)
    + totalDriveMin
    + totalServiceMin
    + (lastToHomeDriveMinutes ?? 0),
  );
  const projectedTotalRouteMinutes = totalServiceMin + totalDriveMin;
  const remainingCapacityMinutes = cap.maxHours > 0
    ? Math.max(0, cap.remainingHours * 60 - projectedTotalRouteMinutes)
    : null;

  const routeFeasibility = {
    currentServiceMinutes: currentServiceMin,
    currentDriveMinutes: Math.round(currentDriveMin),
    projectedServiceMinutes: totalServiceMin,
    projectedDriveMinutes: Math.round(totalDriveMin),
    projectedTotalRouteMinutes: Math.round(projectedTotalRouteMinutes),
    projectedRouteEndTime: fmtTime12h(insertion.projectedRouteEnd),
    homeToFirstStopDriveMinutes,
    lastStopToHomeDriveMinutes: lastToHomeDriveMinutes,
    fullDayDriveMinutes: Math.round(totalDriveMin + (homeToFirstStopDriveMinutes ?? 0) + (lastToHomeDriveMinutes ?? 0)),
    fullDayServiceMinutes: Math.round(totalServiceMin),
    projectedFullDayMinutes,
    projectedStartTime: fmtTime12h(DAY_START_MIN),
    projectedEndTime: fmtTime12h(insertion.projectedRouteEnd),
    remainingCapacityMinutes,
    workloadLabel: workload.workloadLabel,
    workloadLabelDisplay: workload.workloadLabelDisplay,
    routeOptimizationStatus: workload.routeOptimizationStatus,
    durationFallbackCount: workload.durationFallbackCount,
    shiftHoursUnknown: cap.maxHours <= 0,
  };

  const daySummary = {
    startTime: fmtTime12h(DAY_START_MIN),
    endTime: fmtTime12h(insertion.projectedRouteEnd),
    totalStops: stops.length + 1,
    totalDriveHours: Math.round((totalDriveMin / 60) * 10) / 10,
    totalServiceHours: Math.round((totalServiceMin / 60) * 10) / 10,
    capacityLeftHours: Math.round(Math.max(0, cap.remainingHours - durationMin / 60) * 100) / 100,
    currentServiceHours: workload.currentServiceHours,
    workloadLabel: workload.workloadLabelDisplay,
    homeToFirstStopDriveMinutes,
    lastStopToHomeDriveMinutes: lastToHomeDriveMinutes,
    projectedFullDayMinutes,
  };

  return {
    techName:  tech.techName,
    techId:    tech.techId,
    routeId:   tech.routeId,
    stopCount: stops.length,
    clusterDensity: clusterData.count,
    clusterLabel:   clusterData.label,
    closestStop,
    routeSmoothness,
    wasOptimized,
    capacity: {
      currentHours:   cap.currentHours,
      maxHours:       cap.maxHours,
      remainingHours: Math.round(cap.remainingHours * 100) / 100,
    },
    workload,
    routeFeasibility,
    travelProvider: travelCtx?.travelDiagnostics?.travelProvider
      || travelCtx?.getProviderName?.()
      || defaultTravelProvider.getProviderName(),
    travelAccuracy: travelCtx?.travelDiagnostics?.travelAccuracy
      || travelCtx?.getProviderAccuracy?.()
      || defaultTravelProvider.getProviderAccuracy(),
    travelDiagnostics: travelCtx?.travelDiagnostics || {
      travelProvider: travelCtx?.getProviderName?.() || 'haversine',
      travelAccuracy: travelCtx?.getProviderAccuracy?.() || 'estimated',
      fallbackUsed: !travelCtx || travelCtx.getProviderName?.() === 'haversine',
      fallbackReason: !travelCtx ? 'no_travel_context' : null,
      matrixElementsRequested: travelCtx?.diagnostics?.matrixElementsRequested ?? 0,
      cacheHit: Boolean(travelCtx?.diagnostics?.cacheHit),
    },
    scores: {
      geographic:         Math.round(geoScore),
      travelEfficiency:   Math.round(travelScore),
      timeWindow:         Math.round(Math.min(100, windowScore)),
      workload:           Math.round(workloadScore),
      serviceDuration:    Math.round(serviceDurationScore),
      capacity:           Math.round(capacityScore),
      insertionProximity: insertionProximityScore,
      routeAreaBonus,
      workloadPenalty:    workload.workloadPenalty,
      total,
    },
    nearestStopMiles: Math.round(minDist * 10) / 10,
    areaViability,
    homeProximity,
    suggestedWindow,
    reason,
    bestInsertion: {
      afterIndex:              insertion.afterIndex,
      afterCustomerName:       insertion.afterStop?.customerName ?? null,
      beforeCustomerName:      insertion.beforeStop?.customerName ?? null,
      insertAfterLabel,
      insertBeforeLabel,
      estimatedArrivalMin:     insertion.estimatedArrivalMin,
      estimatedArrivalTime:    fmtTime12h(insertion.estimatedArrivalMin),
      suggestedWindow,
      detourMiles:             insertion.detourMiles,
      localProximityMiles:     insertion.localProximityMiles,
      insertionPositionLabel,
      gapAvailableMin:         insertion.gapAvailableMin,
      viable:                  isOverCapacity ? false : insertion.viable,
      // Backtracking
      backtracking:            insertion.backtracking,
      backtrackingRisk:        insertion.backtrackingRisk,
      backtrackingSeverity:    insertion.backtrackingSeverity,
      backtrackingDetail:      insertion.backtrackingDetail,
      // Drive time
      addedDriveMinutes:       insertion.addedDriveMinutes,
      addedDriveTime:          insertion.addedDriveMinutes < 1 ? '< 1 min' : `${insertion.addedDriveMinutes} min`,
      addedMileage:            `${insertion.detourMiles} mi`,
      // Timed appointments
      timedRisk:               insertion.timedRisk,
      timedViolations:         insertion.timedViolations,
      timedAppointmentDetail,
      timedSafetyLabel:        buildTimedSafetyLabel({ ...insertion, timedAppointmentDetail }),
      minTimingBufferMin,
      minTimingBufferLabel,
      delayAdded:              insertion.delayAdded,
      // EOD
      eodSafe:                 insertion.eodSafe,
      projectedRouteEndMin:    insertion.projectedRouteEnd,
      projectedRouteEndTime:   fmtTime12h(insertion.projectedRouteEnd),
      eodLabel,
      // Service
      serviceDurationMin:      durationMin,
      serviceDuration:         durationMin < 60 ? `${durationMin} min` : `${Math.round(durationMin / 60 * 10) / 10} hr`,
      // Start/end fit
      startEndLocationFit:     startEndFit,
      // Optimization
      optimizationConfidence,
      // Stop context
      prevStop,
      nextStop,
    },
    // Cluster detail for display
    clusterDetail: insertionCluster,
    routeStops,
    daySummary,
  };
}

function buildRouteStopsDisplay(stops, timeline, insertion, lead, tech = {}) {
  const rows = [];
  const insertAfter = insertion.afterIndex;
  const startLoc = tech.startLocation?.lat != null ? tech.startLocation : null;
  let endLoc = tech.endLocation?.lat != null ? tech.endLocation : null;
  if (!endLoc && startLoc) endLoc = startLoc;
  const sameHome = startLoc && endLoc
    && haversine(startLoc.lat, startLoc.lng, endLoc.lat, endLoc.lng) <= (ROUTE_AREA_VIABILITY_DEFAULTS.sameHomeLocationMiles ?? 0.05);

  const pushHomeStart = () => {
    if (!startLoc) return;
    rows.push({
      id: 'tech-home-start',
      customerName: 'Technician start / home',
      address: '',
      scheduledTime: fmtTime12h(DAY_START_MIN),
      isTimed: false,
      lat: startLoc.lat,
      lng: startLoc.lng,
      isNew: false,
      isHomeStart: true,
      isHomeEnd: false,
    });
  };

  const pushHomeEnd = () => {
    if (!endLoc) return;
    rows.push({
      id: sameHome ? 'tech-home-end-same' : 'tech-home-end',
      customerName: sameHome ? 'Technician end / home' : 'Technician end / home',
      address: '',
      scheduledTime: fmtTime12h(insertion.projectedRouteEnd),
      isTimed: false,
      lat: endLoc.lat,
      lng: endLoc.lng,
      isNew: false,
      isHomeStart: false,
      isHomeEnd: true,
      hideMapMarker: sameHome,
    });
  };

  const pushStop = (stop, i) => {
    const entry = timeline[i];
    rows.push({
      id: `stop-${i}`,
      customerName: stop.customerName || 'Stop',
      address: stop.address || '',
      scheduledTime: fmtTime12h(entry?.arrivalMin ?? stop.spotStartMinutes),
      isTimed: isTimedStop(stop),
      serviceAbbreviation: getStopServiceAbbreviation(stop),
      timedWindowLabel: formatStopTimedWindowLabel(stop),
      aptStartMinutes: stop.aptStartMinutes,
      aptEndMinutes: stop.aptEndMinutes,
      startTime: stop.startTime,
      endTime: stop.endTime,
      lat: stop.lat,
      lng: stop.lng,
      isNew: false,
    });
  };

  const pushNew = () => {
    rows.push({
      id: 'new-stop',
      customerName: lead.customerName || 'New customer',
      address: lead.address || 'Customer address',
      scheduledTime: fmtTime12h(insertion.estimatedArrivalMin),
      isTimed: false,
      serviceAbbreviation: getLeadServiceAbbreviation(lead),
      lat: lead.lat,
      lng: lead.lng,
      isNew: true,
    });
  };

  pushHomeStart();

  if (insertAfter === -1) {
    pushNew();
    stops.forEach((s, i) => pushStop(s, i));
  } else {
    stops.forEach((s, i) => {
      pushStop(s, i);
      if (i === insertAfter) pushNew();
    });
  }

  pushHomeEnd();

  return rows;
}

// ---------------------------------------------------------------------------
// Internal orchestrator — accepts a config override so tests can inject
// custom weights/thresholds without touching the global SCORER_CONFIG.
// ---------------------------------------------------------------------------

function runScorer(technicians, lead, topN, cfg, travelCtx = null) {
  const prefWindow = parseWindow(lead.timeWindowPreference);
  const routeArea  = lead.routeArea ?? 'general';
  const dayOfWeek  = lead.date ? new Date(lead.date + 'T12:00:00').getDay() : null;
  const routingCtx = { routeArea, dayOfWeek, travelCtx };

  // Global exclusions — always applied before any other filtering
  const exclusionPatterns = cfg.exclusions.techNamePatterns;
  const allowedTechs = technicians.filter(t => {
    if (!t.techName) return false;
    return !exclusionPatterns.some(re => re.test(t.techName));
  });

  // NH: restrict to approved technicians
  let eligibleTechs = allowedTechs;
  if (routeArea === 'new_hampshire') {
    eligibleTechs = allowedTechs.filter(t =>
      cfg.nh.approvedTechNames.includes(t.techName) ||
      cfg.nh.approvedTechIds.includes(t.techId)
    );
  }

  let scored = eligibleTechs
    .map(tech => scoreRoute(tech, lead, prefWindow, routingCtx, cfg))
    .filter(Boolean)
    .sort((a, b) => b.scores.total - a.scores.total);

  scored = applyLighterRoutePreference(scored, cfg.workload);
  if (scored[0]?.workload?.isHeavy) {
    scored[0].chosenDespiteHeavy = true;
  }

  const prefWindowMeta = {
    label:     lead.timeWindowPreference || 'AT',
    startTime: fmtTime12h(prefWindow.start),
    endTime:   fmtTime12h(prefWindow.end),
  };

  // NH: no-safe-route result
  if (routeArea === 'new_hampshire') {
    const noSafeRoute =
      eligibleTechs.length === 0 ||
      scored.length === 0 ||
      !scored[0].bestInsertion;
    if (noSafeRoute) {
      const msg = eligibleTechs.length === 0
        ? 'Alex Gray is not scheduled for this date — no New Hampshire route available.'
        : 'No safe New Hampshire route found for Alex Gray.';
      return {
        lead, prefWindow: prefWindowMeta, routeArea,
        noSafeRoute: true, noSafeRouteMessage: msg,
        totalRoutesScored: scored.length,
        recommendation: null, alternatives: [], topMatches: [],
        allScores: scored.map(r => ({ techName: r.techName, routeId: r.routeId, total: r.scores.total })),
      };
    }
  }

  const topMatches = selectTopMatchesByAreaViability(scored, topN);

  return {
    lead,
    prefWindow: prefWindowMeta,
    routeArea,
    totalRoutesScored: scored.length,
    recommendation: topMatches[0] ?? null,
    alternatives:   topMatches.slice(1),
    topMatches,
    allScores: scored.map(r => ({
      techName:    r.techName,
      routeId:     r.routeId,
      total:       r.scores.total,
      clusterLabel: r.clusterLabel,
      nearestStop: r.nearestStopMiles,
      insertionAt: r.bestInsertion?.insertionPositionLabel ?? null,
      wasOptimized: r.wasOptimized,
    })),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreRoutes(technicians, lead, topN = 3, options = {}) {
  return runScorer(technicians, lead, topN, SCORER_CONFIG, options.travelCtx ?? null);
}

export async function scoreRoutesAsync(technicians, lead, topN = 3, options = {}) {
  let travelCtx = options.travelCtx ?? null;
  if (!travelCtx && options.prefetchTravel !== false) {
    const { prefetchTravelContext } = await import('./routeTravelContext.js');
    travelCtx = await prefetchTravelContext(technicians, lead, options);
  }
  const cfg = options.scorerConfig ?? SCORER_CONFIG;
  return runScorer(technicians, lead, topN, cfg, travelCtx);
}
