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

// ---------------------------------------------------------------------------
// SCORER_CONFIG — single source of truth for all weights, thresholds, and
// business rules. Centralised here so callers (tests, future A/B) can
// clone and override without touching algorithm code.
// ---------------------------------------------------------------------------
export const SCORER_CONFIG = {
  // 'legacy' engine is the only option in Phase 1–3; 'vrptw' added in Phase 4
  engine: 'legacy',

  // Scoring weights — must sum to 1.0
  weights: { geo: 0.20, travel: 0.40, window: 0.30, capacity: 0.10 },

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
    timedRisk:    { high: 60, medium: 35, low: 15 },
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
    gammaTimedAnchor:   8.0,
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
// Core math utilities
// ---------------------------------------------------------------------------

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const r = d => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1);
  const dLng = r(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance-based speed heuristic: urban < 2 mi, suburban 2–8 mi, highway > 8 mi
function pickSpeed(miles) {
  const { profiles } = SCORER_CONFIG.speed;
  if (miles < 2) return profiles.urban;    // 22 mph
  if (miles < 8) return profiles.suburban; // 30 mph
  return profiles.highway;                 // 45 mph
}

function travelMin(miles) {
  return (miles / pickSpeed(miles)) * 60;
}

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
  const h = Math.floor(min / 60);
  const m = min % 60;
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
  const num = parseFloat(str);
  const h = Math.floor(num);
  const m = Math.round((num % 1) * 100);
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
  if (maxLate <= 15) return 'low';
  if (maxLate <= 30) return 'medium';
  return 'high';
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
function simulateRouteTiming(stops, startLat, startLng, startTimeMin = 480) {
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
    const drive = Math.ceil(travelMin(haversine(curLat, curLng, stop.lat, stop.lng)));
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
  const { timedRisk, timedViolations, minTimingBuffer } = insertion;
  if (timedRisk === 'high') {
    const v = timedViolations[0];
    if (v) return `Rejected — would miss ${v.customerName}'s timed window (${fmtTime12h(v.windowEnd)})`;
    return 'Rejected — timed appointment conflict';
  }
  if (timedRisk === 'medium') {
    const v = timedViolations[0];
    if (v) return `Risky — ${v.customerName} would be delayed ${v.lateness} min past window`;
    return 'Risky — moderate impact on timed appointments';
  }
  if (timedRisk === 'low') {
    if (minTimingBuffer != null) return `Risky — only ${minTimingBuffer} min before next timed appointment`;
    return 'Low risk — tight timing buffer';
  }
  if (minTimingBuffer != null && minTimingBuffer < 60) {
    return `Safe — ${minTimingBuffer}-minute buffer before next timed appointment`;
  }
  return 'Safe — no timed appointments affected';
}

// ---------------------------------------------------------------------------
// Insertion candidate score (lower = better)
// ---------------------------------------------------------------------------

function insertionCandidateScore(c, prefStart, prefEnd, durationMin) {
  const pen = SCORER_CONFIG.penalties.insertionCandidate;
  let score = 0;

  // Hard constraint — timed appointment violations only; EOD is no longer a hard gate
  if (c.timedRisk === 'high') score += pen.hardTimedConflict;

  // Primary: geographic insertion quality
  score += c.detourMiles * pen.detourPerMile;
  score += c.localProximityMiles * pen.localProxPerMile;

  // Timed risk (soft)
  if (c.timedRisk === 'medium') score += pen.timedRiskMedium;
  if (c.timedRisk === 'low')    score += pen.timedRiskLow;

  // Window fit
  const inWindow = c.estimatedArrivalMin >= prefStart &&
                   c.estimatedArrivalMin + durationMin <= prefEnd;
  if (!inWindow) score += pen.windowMiss;

  // Cluster bonus
  score -= c.clusterQuality * pen.clusterBonusPerQuality;

  // Viability
  if (!c.viable) score += pen.viabilityMiss;

  // Backtracking penalty — bearing-based severity
  if (c.backtracking) {
    const btPen = pen.backtrackingSeverity;
    score += (btPen[c.backtrackingRisk] ?? 0) + c.backtrackingSeverity * pen.backtrackingMultiplier;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Route simulation — timed appointment protection
// ---------------------------------------------------------------------------

function simulateInsertionDelay(stops, insertIdx, newLat, newLng, newDurationMin) {
  if (insertIdx >= stops.length - 1) {
    return { delayAdded: 0, timedViolations: [], safe: true, minTimingBuffer: null };
  }

  let delayAdded = 0;

  if (insertIdx === -1) {
    // Inserting before the first stop: the new stop takes service time + travel to first stop.
    // That's the additional delay pushed onto the first stop and all downstream stops.
    const first = stops[0];
    const dNewToFirst = haversine(newLat, newLng, first.lat, first.lng);
    delayAdded = Math.round(newDurationMin + travelMin(dNewToFirst));
  } else {
    const prev = stops[insertIdx];
    const next = stops[insertIdx + 1];
    const dPN  = haversine(prev.lat, prev.lng, newLat, newLng);
    const dNX  = haversine(newLat, newLng, next.lat, next.lng);
    const dPX  = haversine(prev.lat, prev.lng, next.lat, next.lng);
    const extraTravel = Math.max(0, travelMin(dPN + dNX - dPX));
    delayAdded = Math.round(extraTravel + newDurationMin);
  }

  const downstreamStart = insertIdx === -1 ? 0 : insertIdx + 1;
  const timedViolations = [];
  let minTimingBuffer = null;

  for (const stop of stops.slice(downstreamStart)) {
    if (!isTimedStop(stop)) continue;
    const projected = stop.spotStartMinutes + delayAdded;
    const windowEnd = parseTimeStr(stop.endTime);
    if (windowEnd != null) {
      const buffer = windowEnd - projected;
      if (minTimingBuffer === null || buffer < minTimingBuffer) minTimingBuffer = buffer;
      if (projected > windowEnd) {
        timedViolations.push({
          customerName:     stop.customerName,
          originalArrival:  stop.spotStartMinutes,
          projectedArrival: projected,
          windowEnd,
          lateness: projected - windowEnd,
        });
      }
    }
  }

  return { delayAdded, timedViolations, safe: timedViolations.length === 0, minTimingBuffer };
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
// Best insertion finder — runs on the optimized route order
// ---------------------------------------------------------------------------

function findBestInsertion(
  stops, leadLat, leadLng, durationMin, prefWindow,
  startLoc, endLoc, routeDirectionBearing
) {
  if (stops.length === 0) return null;

  const hasStart = startLoc?.lat != null && startLoc?.lng != null;
  const hasEnd   = endLoc?.lat   != null && endLoc?.lng   != null;

  const cluster  = computeClusterQuality(stops, leadLat, leadLng);
  const candidates = [];
  const lastStop = stops[stops.length - 1];

  // ── Before first stop ────────────────────────────────────────────────────
  {
    const first = stops[0];
    // Detour cost: startLoc → new → first vs startLoc → first
    const fromLat = hasStart ? startLoc.lat : first.lat;
    const fromLng = hasStart ? startLoc.lng : first.lng;
    const dFromToNew = haversine(fromLat, fromLng, leadLat, leadLng);
    const dNewToFirst = haversine(leadLat, leadLng, first.lat, first.lng);
    const dFromToFirst = haversine(fromLat, fromLng, first.lat, first.lng);
    const detour = Math.max(0, dFromToNew + dNewToFirst - dFromToFirst);

    const arrival = Math.max(480, first.spotStartMinutes - Math.round(travelMin(dNewToFirst)) - durationMin);
    const sim = simulateInsertionDelay(stops, -1, leadLat, leadLng, durationMin);
    const projectedEnd = lastStop.spotStartMinutes + lastStop.durationMinutes + sim.delayAdded +
      (hasEnd ? Math.ceil(travelMin(haversine(lastStop.lat, lastStop.lng, endLoc.lat, endLoc.lng))) : 0);

    candidates.push({
      afterIndex:           -1,
      afterStop:            null,
      beforeStop:           first,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(detour * 10) / 10,
      localProximityMiles:  Math.round(dNewToFirst * 10) / 10,
      gapAvailableMin:      first.spotStartMinutes - arrival,
      viable:               first.spotStartMinutes - arrival >= durationMin,
      backtracking:         false,
      backtrackingRisk:     'None',
      backtrackingSeverity: 0,
      backtrackingDetail:   null,
      delayAdded:           sim.delayAdded,
      timedViolations:      sim.timedViolations,
      timedRisk:            timedRiskLevel(sim.timedViolations),
      minTimingBuffer:      sim.minTimingBuffer,
      addedDriveMinutes:    Math.max(1, Math.round(travelMin(dFromToNew))),
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= WORKDAY_END,
      clusterQuality:       cluster.quality,
    });
  }

  // ── Between adjacent stops ────────────────────────────────────────────────
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (!a.lat || !b.lat) continue;

    const dAN    = haversine(a.lat, a.lng, leadLat, leadLng);
    const dNB    = haversine(leadLat, leadLng, b.lat, b.lng);
    const dAB    = haversine(a.lat, a.lng, b.lat, b.lng);
    const detour = Math.max(0, dAN + dNB - dAB);

    const arrival    = a.spotStartMinutes + a.durationMinutes + Math.round(travelMin(dAN));
    const gap        = b.spotStartMinutes - arrival;
    const sim        = simulateInsertionDelay(stops, i, leadLat, leadLng, durationMin);
    const bt         = measureBacktracking(a, leadLat, leadLng, b, routeDirectionBearing);
    const addedDrive = Math.max(0, Math.round(travelMin(dAN + dNB - dAB)));

    // Projected end includes travel to endLoc if available
    const endTravel = hasEnd
      ? Math.ceil(travelMin(haversine(lastStop.lat, lastStop.lng, endLoc.lat, endLoc.lng)))
      : 0;
    const projectedEnd = lastStop.spotStartMinutes + lastStop.durationMinutes + sim.delayAdded + endTravel;

    candidates.push({
      afterIndex:           i,
      afterStop:            a,
      beforeStop:           b,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(detour * 10) / 10,
      localProximityMiles:  Math.round(Math.min(dAN, dNB) * 10) / 10,
      gapAvailableMin:      gap,
      viable:               gap >= durationMin,
      backtracking:         bt.backtracking,
      backtrackingRisk:     bt.risk,
      backtrackingSeverity: bt.severity,
      backtrackingDetail:   bt.detail,
      delayAdded:           sim.delayAdded,
      timedViolations:      sim.timedViolations,
      timedRisk:            timedRiskLevel(sim.timedViolations),
      minTimingBuffer:      sim.minTimingBuffer,
      addedDriveMinutes:    addedDrive,
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= WORKDAY_END,
      clusterQuality:       cluster.quality,
    });
  }

  // ── After last stop ───────────────────────────────────────────────────────
  {
    const last  = stops[stops.length - 1];
    const dLast = haversine(last.lat, last.lng, leadLat, leadLng);

    // Detour cost: last → new → endLoc vs last → endLoc
    const dNewToEnd  = hasEnd ? haversine(leadLat, leadLng, endLoc.lat, endLoc.lng) : 0;
    const dLastToEnd = hasEnd ? haversine(last.lat, last.lng, endLoc.lat, endLoc.lng) : 0;
    const detour     = hasEnd ? Math.max(0, dLast + dNewToEnd - dLastToEnd) : dLast;

    const arrival    = last.spotStartMinutes + last.durationMinutes + Math.round(travelMin(dLast));
    const projectedEnd = arrival + durationMin + (hasEnd ? Math.ceil(travelMin(dNewToEnd)) : 0);

    candidates.push({
      afterIndex:           stops.length - 1,
      afterStop:            last,
      beforeStop:           null,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(detour * 10) / 10,
      localProximityMiles:  Math.round(dLast * 10) / 10,
      gapAvailableMin:      null,
      viable:               true,
      backtracking:         false,
      backtrackingRisk:     'None',
      backtrackingSeverity: 0,
      backtrackingDetail:   null,
      delayAdded:           0,
      timedViolations:      [],
      timedRisk:            'none',
      minTimingBuffer:      null,
      addedDriveMinutes:    Math.round(travelMin(dLast)),
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= WORKDAY_END,
      clusterQuality:       cluster.quality,
    });
  }

  // Sort: lowest candidate score wins
  const { start, end } = prefWindow;
  candidates.sort((a, b) =>
    insertionCandidateScore(a, start, end, durationMin) -
    insertionCandidateScore(b, start, end, durationMin)
  );

  return { best: candidates[0], clusterData: cluster };
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
  wasOptimized, startEndFit, routeDirectionBearing,
}) {
  const parts = [];

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

  return parts
    .map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)
    .join('. ')
    .replace(/\.\s*$/, '') + '.';
}

// ---------------------------------------------------------------------------
// Per-route scorer
// ---------------------------------------------------------------------------

function scoreRoute(tech, lead, prefWindow, routingCtx = {}, cfg = SCORER_CONFIG) {
  const { routeArea = 'general', dayOfWeek = null } = routingCtx;
  const allStops = tech.stops.filter(s => s.lat && s.lng);
  if (allStops.length === 0) return null;

  const durationMin = lead.durationMinutes ?? getDefaultDuration(lead.serviceType);

  // ── Step 1: internally optimize the route ────────────────────────────────
  const startLoc = tech.startLocation;
  const endLoc   = tech.endLocation;
  const { stops: orderedStops, wasOptimized } = optimizeRouteOrder(allStops, startLoc, endLoc);

  // ── Step 1b: rebuild timing from 8 AM for the optimized order ────────────
  // All techs start at 8 AM. Rebuilding spotStartMinutes from DAY_START_MIN
  // gives accurate arrival estimates regardless of whether FieldRoutes has
  // already optimized the schedule.
  const hasStartLoc = startLoc?.lat != null && startLoc?.lng != null;
  const simFromLat  = hasStartLoc ? startLoc.lat : (orderedStops[0]?.lat ?? lead.lat);
  const simFromLng  = hasStartLoc ? startLoc.lng : (orderedStops[0]?.lng ?? lead.lng);
  const timeline    = simulateRouteTiming(orderedStops, simFromLat, simFromLng, DAY_START_MIN);
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
  const { best: insertion, clusterData: insertionCluster } = findBestInsertion(
    stops, lead.lat, lead.lng, durationMin, prefWindow,
    startLoc, endLoc, routeDirectionBearing
  );

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

  const localProxMiles = insertion.localProximityMiles;
  const insertionProximityScore = Math.round(100 * Math.exp(-localProxMiles / GEO_ZERO_MILES));

  let total = Math.round(
    geoScore      * cfg.weights.geo      +
    travelScore   * cfg.weights.travel   +
    windowScore   * cfg.weights.window   +
    capacityScore * cfg.weights.capacity
  );

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

  const reason = buildReason({
    insertion,
    clusterData: insertionCluster,
    techName: tech.techName,
    totalStops: stops.length,
    homeProximity,
    wasOptimized,
    startEndFit,
    routeDirectionBearing,
  });

  // EOD label — informational only, not a rejection
  const eodLabel = fmtTime12h(insertion.projectedRouteEnd)
    ? `Est. done by ${fmtTime12h(insertion.projectedRouteEnd)}`
    : null;

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
    scores: {
      geographic:         Math.round(geoScore),
      travelEfficiency:   Math.round(travelScore),
      timeWindow:         Math.round(Math.min(100, windowScore)),
      capacity:           Math.round(capacityScore),
      insertionProximity: insertionProximityScore,
      routeAreaBonus,
      total,
    },
    nearestStopMiles: Math.round(minDist * 10) / 10,
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
      timedSafetyLabel:        buildTimedSafetyLabel(insertion),
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
  };
}

// ---------------------------------------------------------------------------
// Internal orchestrator — accepts a config override so tests can inject
// custom weights/thresholds without touching the global SCORER_CONFIG.
// ---------------------------------------------------------------------------

function runScorer(technicians, lead, topN, cfg) {
  const prefWindow = parseWindow(lead.timeWindowPreference);
  const routeArea  = lead.routeArea ?? 'general';
  const dayOfWeek  = lead.date ? new Date(lead.date + 'T12:00:00').getDay() : null;
  const routingCtx = { routeArea, dayOfWeek };

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

  const scored = eligibleTechs
    .map(tech => scoreRoute(tech, lead, prefWindow, routingCtx, cfg))
    .filter(Boolean)
    .sort((a, b) => b.scores.total - a.scores.total);

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

  const topMatches = scored.slice(0, topN).map((r, i) => ({ rank: i + 1, ...r }));

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

export function scoreRoutes(technicians, lead, topN = 3) {
  return runScorer(technicians, lead, topN, SCORER_CONFIG);
}
