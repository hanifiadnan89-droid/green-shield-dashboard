/**
 * FieldRoutes route scorer.
 * Given a new lead and a set of normalized technician routes, returns the
 * top N best-fit routes with per-factor score breakdowns and an estimated
 * insertion point for each.
 */

// Scoring weights — must sum to 1.0
const W = { geo: 0.35, travel: 0.30, window: 0.25, capacity: 0.10 };

// Geographic distance at which geo score hits 0
const GEO_ZERO_MILES = 15;
// Detour distance at which travel score hits 0
const TRAVEL_ZERO_MILES = 8;
// Average route speed used for travel-time estimates
const AVG_SPEED_MPH = 30;
// Route end-of-day cutoff in minutes-from-midnight (8 PM)
const EOD_MIN = 1200;
// Default max route duration (hours) when routeDurationCapacityRaw is absent
const DEFAULT_MAX_HOURS = 10.5;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Haversine distance between two lat/lng points in miles. */
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

/** Miles → estimated travel minutes at AVG_SPEED_MPH. */
function travelMin(miles) {
  return (miles / AVG_SPEED_MPH) * 60;
}

/** Format minutes-from-midnight as "HH:MM". */
function fmtTime(min) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parse a time-window half like "9", "4", "8.3", "12" into minutes-from-midnight.
 * Convention: hours 1–7 are treated as PM (13:00–19:00); 8–23 as-is.
 */
function parseWindowHalf(str) {
  const num = parseFloat(str);
  const h = Math.floor(num);
  const m = Math.round((num % 1) * 100); // ".3" → 30 min (FieldRoutes convention)
  const totalMin = h * 60 + m;
  return h >= 1 && h < 8 ? totalMin + 12 * 60 : totalMin;
}

/**
 * Parse a time-window preference string into { start, end } minutes-from-midnight.
 * Handles: "AT", "AM", "PM", "9-4", "12-4", "8.3-6", etc.
 */
function parseWindow(pref) {
  if (!pref || pref === 'AT') return { start: 480, end: 1200 };
  if (pref === 'AM') return { start: 480, end: 720 };
  if (pref === 'PM') return { start: 720, end: 1080 };
  const m = pref.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!m) return { start: 480, end: 1200 };
  return { start: parseWindowHalf(m[1]), end: parseWindowHalf(m[2]) };
}

/**
 * Parse "6.33/10.5 hrs" → { currentHours, maxHours, remainingHours }.
 * Falls back to DEFAULT_MAX_HOURS if unparseable.
 */
function parseDurationCapacity(raw) {
  if (!raw) return { currentHours: 0, maxHours: DEFAULT_MAX_HOURS, remainingHours: DEFAULT_MAX_HOURS };
  const m = raw.match(/([\d.]+)\s*\/\s*([\d.]+)/);
  if (!m) return { currentHours: 0, maxHours: DEFAULT_MAX_HOURS, remainingHours: DEFAULT_MAX_HOURS };
  const cur = parseFloat(m[1]);
  const max = parseFloat(m[2]);
  return { currentHours: cur, maxHours: max, remainingHours: Math.max(0, max - cur) };
}

// ---------------------------------------------------------------------------
// Insertion point finder
// ---------------------------------------------------------------------------

/**
 * Find the best point to insert a new stop into a route's existing sorted stops.
 * Evaluates: before first, between each adjacent pair, after last.
 * Prefers insertions that are within the customer's preferred time window,
 * then minimises detour cost.
 *
 * @returns Best candidate object or null if no stops exist.
 */
function findBestInsertion(stops, leadLat, leadLng, durationMin, prefWindow) {
  const candidates = [];

  // --- Before first stop ---
  if (stops.length > 0) {
    const first = stops[0];
    const dist = haversine(leadLat, leadLng, first.lat, first.lng);
    const arrival = Math.max(480, first.spotStartMinutes - Math.round(travelMin(dist)) - durationMin);
    candidates.push({
      afterIndex: -1,
      afterCustomerName: null,
      beforeCustomerName: first.customerName,
      estimatedArrivalMin: Math.round(arrival),
      detourMiles: dist,
      gapAvailableMin: first.spotStartMinutes - arrival,
      viable: first.spotStartMinutes - arrival >= durationMin,
    });
  }

  // --- Between adjacent stops ---
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (!a.lat || !b.lat) continue;

    const distA = haversine(a.lat, a.lng, leadLat, leadLng);
    const distB = haversine(leadLat, leadLng, b.lat, b.lng);
    const distAB = haversine(a.lat, a.lng, b.lat, b.lng);
    const detour = Math.max(0, distA + distB - distAB);

    const arrival = a.spotStartMinutes + a.durationMinutes + Math.round(travelMin(distA));
    const gap = b.spotStartMinutes - arrival;

    candidates.push({
      afterIndex: i,
      afterCustomerName: a.customerName,
      beforeCustomerName: b.customerName,
      estimatedArrivalMin: Math.round(arrival),
      detourMiles: detour,
      gapAvailableMin: gap,
      viable: gap >= durationMin,
    });
  }

  // --- After last stop ---
  if (stops.length > 0) {
    const last = stops[stops.length - 1];
    const dist = haversine(last.lat, last.lng, leadLat, leadLng);
    const arrival = last.spotStartMinutes + last.durationMinutes + Math.round(travelMin(dist));
    candidates.push({
      afterIndex: stops.length - 1,
      afterCustomerName: last.customerName,
      beforeCustomerName: null,
      estimatedArrivalMin: Math.round(arrival),
      detourMiles: dist,
      gapAvailableMin: null,
      viable: arrival + durationMin <= EOD_MIN,
    });
  }

  if (candidates.length === 0) return null;

  // Sort: viable first, then prefer window match, then lowest detour
  const { start, end } = prefWindow;
  candidates.sort((a, b) => {
    if (a.viable !== b.viable) return a.viable ? -1 : 1;
    const aFit = a.estimatedArrivalMin >= start && a.estimatedArrivalMin + durationMin <= end;
    const bFit = b.estimatedArrivalMin >= start && b.estimatedArrivalMin + durationMin <= end;
    if (aFit !== bFit) return aFit ? -1 : 1;
    return a.detourMiles - b.detourMiles;
  });

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Per-route scorer
// ---------------------------------------------------------------------------

function scoreRoute(tech, lead, prefWindow) {
  const stops = tech.stops.filter(s => s.lat && s.lng);
  if (stops.length === 0) return null;

  // 1. Geographic — minimum distance from lead to any stop on this route
  const minDist = Math.min(...stops.map(s => haversine(lead.lat, lead.lng, s.lat, s.lng)));
  const geoScore = Math.max(0, 100 - (minDist / GEO_ZERO_MILES) * 100);

  // 2. Travel efficiency — cheapest insertion detour
  const insertion = findBestInsertion(stops, lead.lat, lead.lng, lead.durationMinutes, prefWindow);
  const travelScore = insertion
    ? Math.max(0, 100 - (insertion.detourMiles / TRAVEL_ZERO_MILES) * 100)
    : 0;

  // 3. Time window compatibility at the best insertion point
  let windowScore = 0;
  if (insertion) {
    const arr = insertion.estimatedArrivalMin;
    const done = arr + lead.durationMinutes;
    if (arr >= prefWindow.start && done <= prefWindow.end) {
      windowScore = 100;
    } else if (arr < prefWindow.end && done > prefWindow.start) {
      windowScore = 50;
    }
  }

  // 4. Capacity — remaining duration as a fraction of max
  const cap = parseDurationCapacity(tech.routeDurationCapacityRaw);
  const capacityScore = cap.maxHours > 0
    ? Math.min(100, Math.max(0, (cap.remainingHours / cap.maxHours) * 100))
    : 50;

  const total = Math.round(
    geoScore   * W.geo     +
    travelScore * W.travel  +
    windowScore * W.window  +
    capacityScore * W.capacity
  );

  return {
    techName: tech.techName,
    techId: tech.techId,
    routeId: tech.routeId,
    stopCount: stops.length,
    capacity: {
      currentHours: cap.currentHours,
      maxHours: cap.maxHours,
      remainingHours: Math.round(cap.remainingHours * 100) / 100,
    },
    scores: {
      geographic:       Math.round(geoScore),
      travelEfficiency: Math.round(travelScore),
      timeWindow:       windowScore,
      capacity:         Math.round(capacityScore),
      total,
    },
    nearestStopMiles: Math.round(minDist * 10) / 10,
    bestInsertion: insertion ? {
      afterIndex:          insertion.afterIndex,
      afterCustomerName:   insertion.afterCustomerName,
      beforeCustomerName:  insertion.beforeCustomerName,
      estimatedArrivalMin: insertion.estimatedArrivalMin,
      estimatedArrivalTime: fmtTime(insertion.estimatedArrivalMin),
      detourMiles:         Math.round(insertion.detourMiles * 10) / 10,
      gapAvailableMin:     insertion.gapAvailableMin,
      viable:              insertion.viable,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score all technician routes against a new lead and return the top N matches.
 *
 * @param {Array}  technicians - result.technicians from extractRoutePayload()
 * @param {Object} lead        - { lat, lng, serviceType, durationMinutes, timeWindowPreference }
 * @param {number} topN        - number of top results to return (default 3)
 * @returns {Object} { lead, prefWindow, totalRoutesScored, topMatches, allScores }
 */
export function scoreRoutes(technicians, lead, topN = 3) {
  const prefWindow = parseWindow(lead.timeWindowPreference);

  const scored = technicians
    .map(tech => scoreRoute(tech, lead, prefWindow))
    .filter(Boolean)
    .sort((a, b) => b.scores.total - a.scores.total);

  return {
    lead,
    prefWindow: {
      label:     lead.timeWindowPreference || 'AT',
      startTime: fmtTime(prefWindow.start),
      endTime:   fmtTime(prefWindow.end),
    },
    totalRoutesScored: scored.length,
    topMatches: scored.slice(0, topN).map((r, i) => ({ rank: i + 1, ...r })),
    allScores: scored.map(r => ({
      techName: r.techName,
      routeId:  r.routeId,
      total:    r.scores.total,
    })),
  };
}
