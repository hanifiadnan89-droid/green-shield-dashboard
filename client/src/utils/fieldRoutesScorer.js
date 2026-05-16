/**
 * FieldRoutes route scorer — enhanced insertion logic.
 * Finds the least-disruptive insertion point per technician route,
 * protects timed appointments, factors route-end/start proximity,
 * and returns a ranked recommendation with reason text.
 */

// Scoring weights — must sum to 1.0
const W = { geo: 0.20, travel: 0.40, window: 0.30, capacity: 0.10 };

const GEO_ZERO_MILES    = 15;   // geo score → 0 at this distance
const TRAVEL_ZERO_MILES = 8;    // travel score → 0 at this detour
const AVG_SPEED_MPH     = 30;
const WORKDAY_END       = 1080; // 6 PM — technicians do not work past this
const DEFAULT_MAX_HOURS = 10.5;
const HOME_NEAR_MILES   = 5;    // proximity threshold for start/end area

// Timed stop: appointment window ≤ 6 hours
const TIMED_WINDOW_MAX_MIN = 360;

// Penalty for timed appointment risk (subtracted from total score)
const TIMED_PENALTY = { none: 0, low: 15, medium: 35, high: 60 };

// 2-hour window slots for customer-facing suggestions
const WINDOW_SLOTS = [
  { start: 480,  end: 600,  label: '8:00 AM – 10:00 AM' },
  { start: 600,  end: 720,  label: '10:00 AM – 12:00 PM' },
  { start: 720,  end: 840,  label: '12:00 PM – 2:00 PM' },
  { start: 840,  end: 960,  label: '2:00 PM – 4:00 PM' },
  { start: 960,  end: 1080, label: '4:00 PM – 6:00 PM' },
];

// ---------------------------------------------------------------------------
// Core utilities
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

function travelMin(miles) {
  return (miles / AVG_SPEED_MPH) * 60;
}

function fmtTime12h(min) {
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Parse "HH:MM:SS" or "HH:MM" → minutes from midnight. */
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
  if (!m) return { start: 480, end: 1200 };
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

/** A stop is timed if its appointment window is ≤ 6 hours. */
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

/** Return the 2-hour slot label that contains the given arrival time. */
function suggestCustomerWindow(arrivalMin) {
  if (arrivalMin == null) return null;
  for (const slot of WINDOW_SLOTS) {
    if (arrivalMin >= slot.start && arrivalMin < slot.end) return slot.label;
  }
  return arrivalMin < 480 ? WINDOW_SLOTS[0].label : WINDOW_SLOTS[WINDOW_SLOTS.length - 1].label;
}

// ---------------------------------------------------------------------------
// Route simulation — timed appointment protection
// ---------------------------------------------------------------------------

/**
 * Estimate how many extra minutes inserting a new stop at `insertIdx` adds
 * to the schedule, then check every downstream timed stop for violations.
 *
 * insertIdx == -1          → before first stop
 * insertIdx == stops.length-1 → after last stop (no downstream stops)
 * otherwise                → between stops[insertIdx] and stops[insertIdx+1]
 */
function simulateInsertionDelay(stops, insertIdx, newLat, newLng, newDurationMin) {
  // After last stop — no downstream stops affected
  if (insertIdx >= stops.length - 1) {
    return { delayAdded: 0, timedViolations: [], safe: true };
  }

  let delayAdded = 0;

  if (insertIdx === -1) {
    // Before first stop: tech can start earlier if there is enough time
    const first = stops[0];
    const dToNew   = haversine(first.lat, first.lng, newLat, newLng);
    const dNewToF  = haversine(newLat, newLng, first.lat, first.lng);
    const timeNeeded = Math.round(travelMin(dToNew) + newDurationMin + travelMin(dNewToF));
    const latestStart = first.spotStartMinutes - timeNeeded;
    // If tech can start at or after 8 AM → no delay; otherwise delay = shortfall
    delayAdded = latestStart >= 480 ? 0 : Math.max(0, 480 - latestStart);
  } else {
    // Between stops[insertIdx] and stops[insertIdx + 1]
    const prev = stops[insertIdx];
    const next = stops[insertIdx + 1];
    const dPN  = haversine(prev.lat, prev.lng, newLat, newLng);
    const dNX  = haversine(newLat, newLng, next.lat, next.lng);
    const dPX  = haversine(prev.lat, prev.lng, next.lat, next.lng);
    const extraTravel = Math.max(0, travelMin(dPN + dNX - dPX));
    delayAdded = Math.round(extraTravel + newDurationMin);
  }

  // Walk downstream stops and flag timed violations
  const downstreamStart = insertIdx === -1 ? 0 : insertIdx + 1;
  const timedViolations = [];

  for (const stop of stops.slice(downstreamStart)) {
    if (!isTimedStop(stop)) continue;
    const projected = stop.spotStartMinutes + delayAdded;
    const windowEnd = parseTimeStr(stop.endTime);
    if (windowEnd != null && projected > windowEnd) {
      timedViolations.push({
        customerName:     stop.customerName,
        originalArrival:  stop.spotStartMinutes,
        projectedArrival: projected,
        windowEnd,
        lateness: projected - windowEnd,
      });
    }
  }

  return { delayAdded, timedViolations, safe: timedViolations.length === 0 };
}

// ---------------------------------------------------------------------------
// Backtracking detection
// ---------------------------------------------------------------------------

/**
 * Returns whether inserting the new stop between prev and next causes the
 * technician to travel "backwards" relative to the original route direction.
 * severity: 0 (no backtrack) → 1 (full reversal).
 */
function measureBacktracking(prevStop, newLat, newLng, nextStop) {
  if (!prevStop || !nextStop) return { backtracking: false, severity: 0 };
  const dxAB = nextStop.lng - prevStop.lng;
  const dyAB = nextStop.lat - prevStop.lat;
  const dxAN = newLng - prevStop.lng;
  const dyAN = newLat - prevStop.lat;
  const magAB = Math.sqrt(dxAB * dxAB + dyAB * dyAB);
  const magAN = Math.sqrt(dxAN * dxAN + dyAN * dyAN);
  if (magAB < 1e-10 || magAN < 1e-10) return { backtracking: false, severity: 0 };
  const cosAngle = (dxAB * dxAN + dyAB * dyAN) / (magAB * magAN);
  return {
    backtracking: cosAngle < 0,
    severity: Math.max(0, Math.round(-cosAngle * 10) / 10),
  };
}

// ---------------------------------------------------------------------------
// Home / route-end proximity
// ---------------------------------------------------------------------------

/**
 * Uses the first and last stops as proxies for the technician's start and
 * end-of-day areas. Counts nearby existing stops by AM vs PM timing.
 */
function measureHomeProximity(tech, leadLat, leadLng) {
  const stops = tech.stops.filter(s => s.lat && s.lng);
  if (stops.length === 0) return null;

  const first = stops[0];
  const last  = stops[stops.length - 1];

  const distToStart = Math.round(haversine(leadLat, leadLng, first.lat, first.lng) * 10) / 10;
  const distToEnd   = Math.round(haversine(leadLat, leadLng, last.lat,  last.lng)  * 10) / 10;

  const nearby   = stops.filter(s => haversine(leadLat, leadLng, s.lat, s.lng) <= HOME_NEAR_MILES);
  const nearbyAM = nearby.filter(s => s.spotStartMinutes < 720).length;
  const nearbyPM = nearby.filter(s => s.spotStartMinutes >= 720).length;

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
// Reason builder
// ---------------------------------------------------------------------------

function buildReason({ insertion, timedRisk, homeProximity }) {
  const parts = [];

  // Detour / mileage
  if (insertion.detourMiles <= 0.2) {
    parts.push('adds virtually no extra mileage');
  } else if (insertion.detourMiles < 2) {
    parts.push(`adds only ${insertion.detourMiles} mi of detour`);
  } else {
    parts.push(`adds ${insertion.detourMiles} mi of detour`);
  }

  // Direction
  if (insertion.causesBacktracking) {
    parts.push('slight backtrack from the current route path');
  } else {
    parts.push('keeps the technician moving in the same direction');
  }

  // Timed appointment safety
  if (timedRisk === 'none') {
    parts.push('no timed appointments are affected');
  } else if (timedRisk === 'low') {
    parts.push('minimal risk to existing timed appointments');
  } else if (timedRisk === 'medium') {
    parts.push('may delay one or more timed appointments');
  } else {
    parts.push('high risk of delaying timed appointments');
  }

  // Route start / end proximity
  if (homeProximity) {
    if (homeProximity.nearRouteEnd && homeProximity.nearbyPmStops > homeProximity.nearbyAmStops) {
      parts.push(`customer is ${homeProximity.distToRouteEnd} mi from the route-end area — strong PM fit`);
    } else if (homeProximity.nearRouteStart && homeProximity.nearbyAmStops > homeProximity.nearbyPmStops) {
      parts.push(`customer is ${homeProximity.distToRouteStart} mi from the route-start area — natural AM fit`);
    } else if (homeProximity.nearRouteEnd) {
      parts.push(`customer is near the technician's route-end area`);
    }
  }

  const sentence = parts
    .map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)
    .join(', ') + '.';
  return sentence;
}

// ---------------------------------------------------------------------------
// Insertion point finder
// ---------------------------------------------------------------------------

function findBestInsertion(stops, leadLat, leadLng, durationMin, prefWindow) {
  if (stops.length === 0) return null;
  const candidates = [];
  const lastStop = stops[stops.length - 1];

  // ── Before first stop ──────────────────────────────────────────────────────
  {
    const first = stops[0];
    const dist    = haversine(leadLat, leadLng, first.lat, first.lng);
    const arrival = Math.max(480, first.spotStartMinutes - Math.round(travelMin(dist)) - durationMin);
    const sim     = simulateInsertionDelay(stops, -1, leadLat, leadLng, durationMin);
    const projectedRouteEnd = lastStop.spotStartMinutes + lastStop.durationMinutes + sim.delayAdded;
    candidates.push({
      afterIndex:           -1,
      afterStop:            null,
      beforeStop:           first,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(dist * 10) / 10,
      gapAvailableMin:      first.spotStartMinutes - arrival,
      viable:               first.spotStartMinutes - arrival >= durationMin,
      causesBacktracking:   false,
      backtrackingSeverity: 0,
      delayAdded:           sim.delayAdded,
      timedViolations:      sim.timedViolations,
      timedRisk:            timedRiskLevel(sim.timedViolations),
      addedDriveMinutes:    Math.max(1, Math.round(travelMin(dist))),
      projectedRouteEnd,
      eodSafe:              projectedRouteEnd <= WORKDAY_END,
    });
  }

  // ── Between adjacent stops ─────────────────────────────────────────────────
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
    const bt         = measureBacktracking(a, leadLat, leadLng, b);
    const addedDrive = Math.max(0, Math.round(travelMin(dAN + dNB - dAB)));
    const projectedRouteEnd = lastStop.spotStartMinutes + lastStop.durationMinutes + sim.delayAdded;

    candidates.push({
      afterIndex:           i,
      afterStop:            a,
      beforeStop:           b,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(detour * 10) / 10,
      gapAvailableMin:      gap,
      viable:               gap >= durationMin,
      causesBacktracking:   bt.backtracking,
      backtrackingSeverity: bt.severity,
      delayAdded:           sim.delayAdded,
      timedViolations:      sim.timedViolations,
      timedRisk:            timedRiskLevel(sim.timedViolations),
      addedDriveMinutes:    addedDrive,
      projectedRouteEnd,
      eodSafe:              projectedRouteEnd <= WORKDAY_END,
    });
  }

  // ── After last stop ────────────────────────────────────────────────────────
  {
    const last    = stops[stops.length - 1];
    const dist    = haversine(last.lat, last.lng, leadLat, leadLng);
    const arrival = last.spotStartMinutes + last.durationMinutes + Math.round(travelMin(dist));
    const projectedRouteEnd = arrival + durationMin;
    candidates.push({
      afterIndex:           stops.length - 1,
      afterStop:            last,
      beforeStop:           null,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(dist * 10) / 10,
      gapAvailableMin:      null,
      viable:               projectedRouteEnd <= WORKDAY_END,
      causesBacktracking:   false,
      backtrackingSeverity: 0,
      delayAdded:           0,
      timedViolations:      [],
      timedRisk:            'none',
      addedDriveMinutes:    Math.round(travelMin(dist)),
      projectedRouteEnd,
      eodSafe:              projectedRouteEnd <= WORKDAY_END,
    });
  }

  // ── Sort: timed safety → eod safety → viability → window fit → no backtrack → detour ───
  const { start, end } = prefWindow;
  const riskRank = { none: 0, low: 1, medium: 2, high: 3 };

  candidates.sort((a, b) => {
    const rA = riskRank[a.timedRisk] ?? 0;
    const rB = riskRank[b.timedRisk] ?? 0;
    if (rA !== rB) return rA - rB;
    if (a.eodSafe !== b.eodSafe) return a.eodSafe ? -1 : 1;
    if (a.viable !== b.viable) return a.viable ? -1 : 1;
    const aFit = a.estimatedArrivalMin >= start && a.estimatedArrivalMin + durationMin <= end;
    const bFit = b.estimatedArrivalMin >= start && b.estimatedArrivalMin + durationMin <= end;
    if (aFit !== bFit) return aFit ? -1 : 1;
    if (a.causesBacktracking !== b.causesBacktracking) return a.causesBacktracking ? 1 : -1;
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

  const homeProximity = measureHomeProximity(tech, lead.lat, lead.lng);

  // 1. Geographic — min distance from lead to any route stop
  const minDist  = Math.min(...stops.map(s => haversine(lead.lat, lead.lng, s.lat, s.lng)));
  const geoScore = Math.max(0, 100 - (minDist / GEO_ZERO_MILES) * 100);

  // 2. Travel efficiency — detour cost of best insertion
  const insertion   = findBestInsertion(stops, lead.lat, lead.lng, lead.durationMinutes, prefWindow);
  const travelScore = insertion
    ? Math.max(0, 100 - (insertion.detourMiles / TRAVEL_ZERO_MILES) * 100)
    : 0;

  // 3. Time window compatibility at insertion point
  let windowScore = 0;
  if (insertion) {
    const arr  = insertion.estimatedArrivalMin;
    const done = arr + lead.durationMinutes;
    if (arr >= prefWindow.start && done <= prefWindow.end) windowScore = 100;
    else if (arr < prefWindow.end && done > prefWindow.start) windowScore = 50;

    // Home-proximity timing bonus (≤ 15 pts) when route-area aligns with preference
    if (homeProximity?.timingSuggestion) {
      const pref = lead.timeWindowPreference;
      const fits =
        (homeProximity.timingSuggestion === 'AM' && (pref === 'AM' || pref === 'AT')) ||
        (homeProximity.timingSuggestion === 'PM' && (pref === 'PM' || pref === 'AT'));
      if (fits) windowScore = Math.min(100, windowScore + 15);
    }
  }

  // 4. Capacity
  const cap          = parseDurationCapacity(tech.routeDurationCapacityRaw);
  const capacityScore = cap.maxHours > 0
    ? Math.min(100, Math.max(0, (cap.remainingHours / cap.maxHours) * 100))
    : 50;

  // Raw score
  let total = Math.round(
    geoScore      * W.geo      +
    travelScore   * W.travel   +
    windowScore   * W.window   +
    capacityScore * W.capacity
  );

  // Timed appointment risk penalty
  if (insertion) {
    total -= TIMED_PENALTY[insertion.timedRisk] ?? 0;

    // End-of-day safety penalty
    if (!insertion.eodSafe) total -= 50;

    // Backtracking penalty (10–20 pts)
    if (insertion.causesBacktracking) {
      total -= Math.round(10 + insertion.backtrackingSeverity * 10);
    }
  }

  total = Math.max(0, total);

  // Build stop context for display
  const prevStop = insertion?.afterStop ? {
    customerName:     insertion.afterStop.customerName,
    address:          insertion.afterStop.address,
    scheduledArrival: fmtTime12h(insertion.afterStop.spotStartMinutes),
    isTimed:          isTimedStop(insertion.afterStop),
  } : null;

  const nextStop = insertion?.beforeStop ? {
    customerName:     insertion.beforeStop.customerName,
    address:          insertion.beforeStop.address,
    scheduledArrival: fmtTime12h(insertion.beforeStop.spotStartMinutes),
    isTimed:          isTimedStop(insertion.beforeStop),
    windowLabel:      isTimedStop(insertion.beforeStop)
      ? `${fmtTime12h(parseTimeStr(insertion.beforeStop.startTime))} – ${fmtTime12h(parseTimeStr(insertion.beforeStop.endTime))}`
      : null,
  } : null;

  const suggestedWindow = insertion ? suggestCustomerWindow(insertion.estimatedArrivalMin) : null;
  const reason = insertion
    ? buildReason({ insertion, timedRisk: insertion.timedRisk, homeProximity })
    : 'No valid insertion point found.';

  return {
    techName:  tech.techName,
    techId:    tech.techId,
    routeId:   tech.routeId,
    stopCount: stops.length,
    capacity: {
      currentHours:   cap.currentHours,
      maxHours:       cap.maxHours,
      remainingHours: Math.round(cap.remainingHours * 100) / 100,
    },
    scores: {
      geographic:       Math.round(geoScore),
      travelEfficiency: Math.round(travelScore),
      timeWindow:       Math.round(Math.min(100, windowScore)),
      capacity:         Math.round(capacityScore),
      total,
    },
    nearestStopMiles: Math.round(minDist * 10) / 10,
    homeProximity,
    suggestedWindow,
    reason,
    bestInsertion: insertion ? {
      afterIndex:           insertion.afterIndex,
      afterCustomerName:    insertion.afterStop?.customerName ?? null,
      beforeCustomerName:   insertion.beforeStop?.customerName ?? null,
      estimatedArrivalMin:  insertion.estimatedArrivalMin,
      estimatedArrivalTime: fmtTime12h(insertion.estimatedArrivalMin),
      suggestedWindow,
      detourMiles:          insertion.detourMiles,
      gapAvailableMin:      insertion.gapAvailableMin,
      viable:               insertion.viable,
      causesBacktracking:   insertion.causesBacktracking,
      addedDriveMinutes:    insertion.addedDriveMinutes,
      addedDriveTime:       insertion.addedDriveMinutes < 1 ? '< 1 min' : `${insertion.addedDriveMinutes} min`,
      timedRisk:             insertion.timedRisk,
      timedViolations:       insertion.timedViolations,
      delayAdded:            insertion.delayAdded,
      eodSafe:               insertion.eodSafe,
      projectedRouteEndMin:  insertion.projectedRouteEnd,
      projectedRouteEndTime: fmtTime12h(insertion.projectedRouteEnd),
      serviceDurationMin:    lead.durationMinutes,
      serviceDuration:       lead.durationMinutes < 60
        ? `${lead.durationMinutes} min`
        : `${Math.round(lead.durationMinutes / 60 * 10) / 10} hr`,
      prevStop,
      nextStop,
    } : null,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreRoutes(technicians, lead, topN = 3) {
  const prefWindow = parseWindow(lead.timeWindowPreference);

  const scored = technicians
    .map(tech => scoreRoute(tech, lead, prefWindow))
    .filter(Boolean)
    .sort((a, b) => b.scores.total - a.scores.total);

  const topMatches = scored.slice(0, topN).map((r, i) => ({ rank: i + 1, ...r }));

  return {
    lead,
    prefWindow: {
      label:     lead.timeWindowPreference || 'AT',
      startTime: fmtTime12h(prefWindow.start),
      endTime:   fmtTime12h(prefWindow.end),
    },
    totalRoutesScored: scored.length,
    recommendation: topMatches[0] ?? null,
    alternatives:   topMatches.slice(1),
    topMatches,
    allScores: scored.map(r => ({
      techName: r.techName,
      routeId:  r.routeId,
      total:    r.scores.total,
    })),
  };
}
