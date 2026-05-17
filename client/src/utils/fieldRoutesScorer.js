/**
 * FieldRoutes route scorer — geo-first insertion logic.
 *
 * Key change from previous version:
 * Insertion candidates are now ranked by a weighted score where DETOUR MILES
 * and LOCAL PROXIMITY are primary. "After last stop" no longer auto-wins just
 * because it has no downstream timed stops. Timed violations (high/medium) and
 * EOD violations remain hard constraints.
 */

// Scoring weights — must sum to 1.0
const W = { geo: 0.20, travel: 0.40, window: 0.30, capacity: 0.10 };

// Service duration defaults by type (minutes)
const SERVICE_DURATIONS = {
  'Regular Service': 30,
  'T&M':             30,
  'Initial Service': 60,
  'Initial':         60,
};

export function getDefaultDuration(serviceType) {
  return SERVICE_DURATIONS[serviceType] ?? 30;
}

// Cluster density: stops within this radius count as "nearby"
const CLUSTER_RADIUS_MILES = 5;

const GEO_ZERO_MILES    = 15;   // geo score → 0 at this distance
const TRAVEL_ZERO_MILES = 8;    // travel score → 0 at this detour
const AVG_SPEED_MPH     = 30;
const WORKDAY_END       = 1080; // 6:00 PM
const DEFAULT_MAX_HOURS = 10.5;
const HOME_NEAR_MILES   = 5;

const TIMED_WINDOW_MAX_MIN = 360; // ≤ 6-hour window = timed stop

// NH routing configuration
export const NH_CONFIG = {
  approvedTechNames: ['Alex Gray'],
  approvedTechIds:   [10068],
};

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

function suggestCustomerWindow(arrivalMin) {
  if (arrivalMin == null) return null;
  for (const slot of WINDOW_SLOTS) {
    if (arrivalMin >= slot.start && arrivalMin < slot.end) return slot.label;
  }
  return arrivalMin < 480 ? WINDOW_SLOTS[0].label : WINDOW_SLOTS[WINDOW_SLOTS.length - 1].label;
}

// ---------------------------------------------------------------------------
// New: timed safety label for UI display
// ---------------------------------------------------------------------------

function buildTimedSafetyLabel(insertion) {
  const { timedRisk, timedViolations, minTimingBuffer } = insertion;
  if (timedRisk === 'high') {
    const v = timedViolations[0];
    if (v) {
      return `Rejected — would miss ${v.customerName}'s timed window (${fmtTime12h(v.windowEnd)})`;
    }
    return 'Rejected — timed appointment conflict';
  }
  if (timedRisk === 'medium') {
    const v = timedViolations[0];
    if (v) {
      return `Risky — ${v.customerName} would be delayed ${v.lateness} min past window`;
    }
    return 'Risky — moderate impact on timed appointments';
  }
  if (timedRisk === 'low') {
    if (minTimingBuffer != null) {
      return `Risky — only ${minTimingBuffer} min before next timed appointment`;
    }
    return 'Low risk — tight timing buffer';
  }
  if (minTimingBuffer != null && minTimingBuffer < 45) {
    return `Safe — ${minTimingBuffer} min buffer before next timed appointment`;
  }
  return 'Safe — no timed appointments affected';
}

// ---------------------------------------------------------------------------
// New: cluster label for display
// ---------------------------------------------------------------------------

function getClusterLabel(count) {
  if (count >= 4) return `Strong cluster (${count} nearby stops within ${CLUSTER_RADIUS_MILES} mi)`;
  if (count === 3) return `Moderate cluster (3 nearby stops within ${CLUSTER_RADIUS_MILES} mi)`;
  if (count === 2) return `2 nearby stops within ${CLUSTER_RADIUS_MILES} mi`;
  if (count === 1) return `1 nearby stop within ${CLUSTER_RADIUS_MILES} mi`;
  return `No stops within ${CLUSTER_RADIUS_MILES} mi of new customer`;
}

// ---------------------------------------------------------------------------
// New: per-insertion candidate score (lower = better)
// Replaces the previous multi-criteria sort. Detour and local proximity are
// primary so that a geographically well-placed mid-route insertion beats an
// end-of-route insertion that just happens to have no downstream stops.
// ---------------------------------------------------------------------------

function insertionCandidateScore(c, prefStart, prefEnd, durationMin) {
  let score = 0;

  // Hard constraints — massive penalty, effectively never wins
  if (!c.eodSafe)              score += 1000;
  if (c.timedRisk === 'high')  score += 500;

  // PRIMARY: geographic insertion quality
  // detour miles: how much extra driving does this insertion add?
  score += c.detourMiles * 10;
  // local proximity: how close is the new stop to its bounding stops?
  score += c.localProximityMiles * 5;

  // Timed risk (medium/low — real cost but not a hard block)
  if (c.timedRisk === 'medium') score += 50;
  if (c.timedRisk === 'low')    score += 20;

  // Window fit (soft preference — worth ~1.5 mi of detour savings)
  const inWindow = c.estimatedArrivalMin >= prefStart &&
                   c.estimatedArrivalMin + durationMin <= prefEnd;
  if (!inWindow) score += 15;

  // Cluster density bonus: nearby route stops improve insertion quality
  score -= c.clusterDensity * 2;

  // Viability (gap large enough) — now a soft criterion, not a gate
  if (!c.viable) score += 10;

  // Backtracking
  if (c.causesBacktracking) score += 10 + c.backtrackingSeverity * 10;

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
    const first = stops[0];
    const dToNew  = haversine(first.lat, first.lng, newLat, newLng);
    const dNewToF = haversine(newLat, newLng, first.lat, first.lng);
    const timeNeeded = Math.round(travelMin(dToNew) + newDurationMin + travelMin(dNewToF));
    const latestStart = first.spotStartMinutes - timeNeeded;
    delayAdded = latestStart >= 480 ? 0 : Math.max(0, 480 - latestStart);
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
// Backtracking detection
// ---------------------------------------------------------------------------

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
// Reason builder — geo-aware, mentions closest stop by name
// ---------------------------------------------------------------------------

function buildReason({ insertion, timedRisk, homeProximity, closestStop, clusterLabel, techName, totalStops }) {
  const parts = [];

  // Lead with geographic rationale
  if (closestStop && closestStop.distanceMiles <= CLUSTER_RADIUS_MILES) {
    const stopName = closestStop.customerName || closestStop.address || 'a nearby stop';
    const timeStr  = closestStop.scheduledTime ? ` around ${closestStop.scheduledTime}` : '';
    parts.push(
      `${techName} will already be near ${stopName} ` +
      `(stop ${closestStop.stopIndex}, ${closestStop.distanceMiles} mi away${timeStr})`
    );
  }

  // Insertion position rationale
  const isEndOfRoute  = insertion.afterIndex >= totalStops - 1;
  const isStartRoute  = insertion.afterIndex === -1;

  if (isEndOfRoute) {
    if (closestStop && closestStop.distanceMiles <= CLUSTER_RADIUS_MILES) {
      parts.push(
        `placed after last stop because mid-route timing constraints prevented insertion at the nearby cluster — ` +
        `adds ${insertion.detourMiles} mi from route end`
      );
    } else {
      parts.push(`placed after last stop — new customer is ${insertion.detourMiles} mi from the route end area`);
    }
  } else if (isStartRoute) {
    parts.push(`placed before first stop — adds ${insertion.detourMiles} mi`);
  } else {
    const stopLabel = `stop ${insertion.afterIndex + 1} of ${totalStops}`;
    parts.push(
      `inserting at ${stopLabel} adds ${insertion.detourMiles} mi and ${insertion.addedDriveMinutes} min drive`
    );
  }

  // Cluster context
  if (clusterLabel && !clusterLabel.startsWith('No stops')) {
    parts.push(clusterLabel.toLowerCase());
  }

  // Timed appointment safety
  if (timedRisk === 'none') {
    if (insertion.minTimingBuffer != null && insertion.minTimingBuffer < 45) {
      parts.push(`timed appointments safe (${insertion.minTimingBuffer} min buffer)`);
    } else {
      parts.push('no timed appointments affected');
    }
  } else if (timedRisk === 'low') {
    const buf = insertion.minTimingBuffer;
    parts.push(`timed appointment risk is low${buf != null ? ` (${buf} min buffer)` : ''}`);
  }

  // Backtracking
  if (insertion.causesBacktracking) {
    parts.push('slight backtrack from the route direction');
  } else {
    parts.push('no backtracking');
  }

  // Home proximity timing note
  if (homeProximity) {
    if (homeProximity.nearRouteEnd && homeProximity.nearbyPmStops > homeProximity.nearbyAmStops) {
      parts.push(`customer is ${homeProximity.distToRouteEnd} mi from the route-end area — strong PM fit`);
    } else if (homeProximity.nearRouteStart && homeProximity.nearbyAmStops > homeProximity.nearbyPmStops) {
      parts.push(`customer is ${homeProximity.distToRouteStart} mi from the route-start area — natural AM fit`);
    }
  }

  return parts
    .map((p, i) => i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)
    .join('. ') + '.';
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
  if (routeArea === 'new_hampshire') {
    const isMWF      = [1, 3, 5].includes(dayOfWeek);
    const isTuTh     = [2, 4].includes(dayOfWeek);
    const isSouthNH  = lat < 43.5;
    const isNorthNH  = lat >= 43.5;
    const isSeacoast = lng > -71.0;
    if (isMWF  && isSouthNH)                 return 8;
    if (isTuTh && (isNorthNH || isSeacoast)) return 8;
  }
  if (routeArea === 'maine') {
    const isMWF     = [1, 3, 5].includes(dayOfWeek);
    const isTuTh    = [2, 4].includes(dayOfWeek);
    const isCoastal = lng > -70.5;
    if (isMWF  && isCoastal)  return 6;
    if (isTuTh && !isCoastal) return 6;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Insertion point finder — geo-first candidate ranking
// ---------------------------------------------------------------------------

function findBestInsertion(stops, leadLat, leadLng, durationMin, prefWindow) {
  if (stops.length === 0) return null;
  const candidates = [];
  const lastStop = stops[stops.length - 1];

  // Route-level cluster density (shared across all candidates for this route)
  const clusterDensity = stops.filter(
    s => haversine(leadLat, leadLng, s.lat, s.lng) <= CLUSTER_RADIUS_MILES
  ).length;

  // ── Before first stop ───────────────────────────────────────────────────
  {
    const first = stops[0];
    const distToFirst  = haversine(leadLat, leadLng, first.lat, first.lng);
    const arrival      = Math.max(480, first.spotStartMinutes - Math.round(travelMin(distToFirst)) - durationMin);
    const sim          = simulateInsertionDelay(stops, -1, leadLat, leadLng, durationMin);
    const projectedEnd = lastStop.spotStartMinutes + lastStop.durationMinutes + sim.delayAdded;
    candidates.push({
      afterIndex:           -1,
      afterStop:            null,
      beforeStop:           first,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(distToFirst * 10) / 10,
      localProximityMiles:  Math.round(distToFirst * 10) / 10, // nearest bounding stop = first
      gapAvailableMin:      first.spotStartMinutes - arrival,
      viable:               first.spotStartMinutes - arrival >= durationMin,
      causesBacktracking:   false,
      backtrackingSeverity: 0,
      delayAdded:           sim.delayAdded,
      timedViolations:      sim.timedViolations,
      timedRisk:            timedRiskLevel(sim.timedViolations),
      minTimingBuffer:      sim.minTimingBuffer,
      addedDriveMinutes:    Math.max(1, Math.round(travelMin(distToFirst))),
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= WORKDAY_END,
      clusterDensity,
    });
  }

  // ── Between adjacent stops ──────────────────────────────────────────────
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
    const projectedEnd = lastStop.spotStartMinutes + lastStop.durationMinutes + sim.delayAdded;

    candidates.push({
      afterIndex:           i,
      afterStop:            a,
      beforeStop:           b,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(detour * 10) / 10,
      localProximityMiles:  Math.round(Math.min(dAN, dNB) * 10) / 10, // nearest bounding stop
      gapAvailableMin:      gap,
      viable:               gap >= durationMin,
      causesBacktracking:   bt.backtracking,
      backtrackingSeverity: bt.severity,
      delayAdded:           sim.delayAdded,
      timedViolations:      sim.timedViolations,
      timedRisk:            timedRiskLevel(sim.timedViolations),
      minTimingBuffer:      sim.minTimingBuffer,
      addedDriveMinutes:    addedDrive,
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= WORKDAY_END,
      clusterDensity,
    });
  }

  // ── After last stop ─────────────────────────────────────────────────────
  {
    const last    = stops[stops.length - 1];
    const dist    = haversine(last.lat, last.lng, leadLat, leadLng);
    const arrival = last.spotStartMinutes + last.durationMinutes + Math.round(travelMin(dist));
    const projectedEnd = arrival + durationMin;
    candidates.push({
      afterIndex:           stops.length - 1,
      afterStop:            last,
      beforeStop:           null,
      estimatedArrivalMin:  Math.round(arrival),
      detourMiles:          Math.round(dist * 10) / 10,
      localProximityMiles:  Math.round(dist * 10) / 10, // nearest bounding stop = last
      gapAvailableMin:      null,
      viable:               projectedEnd <= WORKDAY_END,
      causesBacktracking:   false,
      backtrackingSeverity: 0,
      delayAdded:           0,
      timedViolations:      [],
      timedRisk:            'none',
      minTimingBuffer:      null,
      addedDriveMinutes:    Math.round(travelMin(dist)),
      projectedRouteEnd:    projectedEnd,
      eodSafe:              projectedEnd <= WORKDAY_END,
      clusterDensity,
    });
  }

  // ── Geo-first sort using weighted candidate score ────────────────────────
  // Lower score = better insertion point.
  // Detour + local proximity are primary. EOD and high timed risk are hard gates.
  // This eliminates end-of-route bias: a mid-route insertion 0.3 mi from the new
  // customer beats an end-of-route insertion 4 mi away, even when the end has no
  // downstream timed stops to worry about.
  const { start, end } = prefWindow;
  candidates.sort((a, b) =>
    insertionCandidateScore(a, start, end, durationMin) -
    insertionCandidateScore(b, start, end, durationMin)
  );

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Route smoothness label
// ---------------------------------------------------------------------------

function getRouteSmoothness(insertion) {
  if (!insertion) return null;
  if (!insertion.eodSafe || insertion.timedRisk === 'high') return 'Difficult fit';
  if (insertion.timedRisk === 'medium') return 'Some disruption';
  if (insertion.causesBacktracking || insertion.timedRisk === 'low') return 'Minor adjustment';
  if (!insertion.viable) return 'Tight gap';
  return 'Smooth fit';
}

// ---------------------------------------------------------------------------
// Per-route scorer
// ---------------------------------------------------------------------------

function scoreRoute(tech, lead, prefWindow, routingCtx = {}) {
  const { routeArea = 'general', dayOfWeek = null } = routingCtx;
  const stops = tech.stops.filter(s => s.lat && s.lng);
  if (stops.length === 0) return null;

  const durationMin    = lead.durationMinutes ?? getDefaultDuration(lead.serviceType);
  const homeProximity  = measureHomeProximity(tech, lead.lat, lead.lng);

  // Route-level cluster metrics
  const clusterDensity = stops.filter(
    s => haversine(lead.lat, lead.lng, s.lat, s.lng) <= CLUSTER_RADIUS_MILES
  ).length;
  const clusterLabel = getClusterLabel(clusterDensity);

  // Closest stop — the single route stop geographically nearest to the new customer
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

  // 1. Geographic — min distance from lead to any route stop
  const minDist  = closestStopData?.dist ?? Infinity;
  const geoScore = Math.max(0, 100 - (minDist / GEO_ZERO_MILES) * 100);

  // 2. Travel efficiency — detour at the geo-optimal insertion point
  const insertion   = findBestInsertion(stops, lead.lat, lead.lng, durationMin, prefWindow);
  const travelScore = insertion
    ? Math.max(0, 100 - (insertion.detourMiles / TRAVEL_ZERO_MILES) * 100)
    : 0;

  // 3. Time window compatibility at insertion point
  let windowScore = 0;
  if (insertion) {
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
  }

  // 4. Capacity
  const cap           = parseDurationCapacity(tech.routeDurationCapacityRaw);
  const capacityScore = cap.maxHours > 0
    ? Math.min(100, Math.max(0, (cap.remainingHours / cap.maxHours) * 100))
    : 50;

  // 5. Insertion proximity score — how well the new customer fits at the chosen insertion point
  const localProxMiles = insertion?.localProximityMiles ?? minDist;
  const insertionProximityScore = Math.round(Math.max(0, 100 - (localProxMiles / GEO_ZERO_MILES) * 100));

  // Raw weighted score
  let total = Math.round(
    geoScore      * W.geo      +
    travelScore   * W.travel   +
    windowScore   * W.window   +
    capacityScore * W.capacity
  );

  // Timed appointment risk penalty
  if (insertion) {
    if (insertion.timedRisk === 'high')   total -= 60;
    if (insertion.timedRisk === 'medium') total -= 35;
    if (insertion.timedRisk === 'low')    total -= 15;

    // EOD safety penalty
    if (!insertion.eodSafe) total -= 50;

    // Backtracking penalty
    if (insertion.causesBacktracking) {
      total -= Math.round(10 + insertion.backtrackingSeverity * 10);
    }

    // End-of-route bias penalty: if best insertion is after last stop but
    // there is a nearby cluster, the route is geographically sub-optimal
    const bestIsEndOfRoute = insertion.afterIndex === stops.length - 1;
    if (bestIsEndOfRoute && clusterDensity > 0) {
      total -= 8;
    }
  }

  total = Math.max(0, total);

  // Route area / day-of-week soft bonus
  const routeAreaBonus = dayOfWeek !== null
    ? getRouteAreaDayBonus(routeArea, lead.lat, lead.lng, dayOfWeek)
    : 0;
  if (routeAreaBonus > 0) total = Math.min(100, total + routeAreaBonus);

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
    ? buildReason({
        insertion,
        timedRisk:   insertion.timedRisk,
        homeProximity,
        closestStop,
        clusterLabel,
        techName:    tech.techName,
        totalStops:  stops.length,
      })
    : 'No valid insertion point found.';

  const routeSmoothness = getRouteSmoothness(insertion);

  const minTimingBufferMin   = insertion?.minTimingBuffer ?? null;
  const minTimingBufferLabel = minTimingBufferMin === null ? null
    : minTimingBufferMin < 0 ? null
    : `${minTimingBufferMin} min before next timed appt`;

  // Insertion position label for display
  let insertionPositionLabel = null;
  if (insertion) {
    if (insertion.afterIndex === -1) {
      insertionPositionLabel = `Before stop 1 of ${stops.length}`;
    } else if (insertion.afterIndex === stops.length - 1) {
      insertionPositionLabel = `After stop ${stops.length} of ${stops.length} (end of route)`;
    } else {
      insertionPositionLabel = `After stop ${insertion.afterIndex + 1} of ${stops.length}`;
    }
  }

  return {
    techName:  tech.techName,
    techId:    tech.techId,
    routeId:   tech.routeId,
    stopCount: stops.length,
    clusterDensity,
    clusterLabel,
    closestStop,
    routeSmoothness,
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
    bestInsertion: insertion ? {
      afterIndex:              insertion.afterIndex,
      afterCustomerName:       insertion.afterStop?.customerName ?? null,
      beforeCustomerName:      insertion.beforeStop?.customerName ?? null,
      estimatedArrivalMin:     insertion.estimatedArrivalMin,
      estimatedArrivalTime:    fmtTime12h(insertion.estimatedArrivalMin),
      suggestedWindow,
      detourMiles:             insertion.detourMiles,
      localProximityMiles:     insertion.localProximityMiles,
      insertionPositionLabel,
      gapAvailableMin:         insertion.gapAvailableMin,
      viable:                  insertion.viable,
      causesBacktracking:      insertion.causesBacktracking,
      addedDriveMinutes:       insertion.addedDriveMinutes,
      addedDriveTime:          insertion.addedDriveMinutes < 1 ? '< 1 min' : `${insertion.addedDriveMinutes} min`,
      timedRisk:               insertion.timedRisk,
      timedViolations:         insertion.timedViolations,
      timedSafetyLabel:        buildTimedSafetyLabel(insertion),
      minTimingBufferMin,
      minTimingBufferLabel,
      delayAdded:              insertion.delayAdded,
      eodSafe:                 insertion.eodSafe,
      projectedRouteEndMin:    insertion.projectedRouteEnd,
      projectedRouteEndTime:   fmtTime12h(insertion.projectedRouteEnd),
      eodLabel: insertion.eodSafe
        ? `Safe — done by ${fmtTime12h(insertion.projectedRouteEnd)}`
        : `Rejected — route would end at ${fmtTime12h(insertion.projectedRouteEnd)} (past 6:00 PM)`,
      serviceDurationMin:      durationMin,
      serviceDuration:         durationMin < 60
        ? `${durationMin} min`
        : `${Math.round(durationMin / 60 * 10) / 10} hr`,
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
  const routeArea  = lead.routeArea ?? 'general';
  const dayOfWeek  = lead.date ? new Date(lead.date + 'T12:00:00').getDay() : null;
  const routingCtx = { routeArea, dayOfWeek };

  // NH: restrict scoring to approved technicians only
  let eligibleTechs = technicians;
  if (routeArea === 'new_hampshire') {
    eligibleTechs = technicians.filter(t =>
      NH_CONFIG.approvedTechNames.includes(t.techName) ||
      NH_CONFIG.approvedTechIds.includes(t.techId)
    );
  }

  const scored = eligibleTechs
    .map(tech => scoreRoute(tech, lead, prefWindow, routingCtx))
    .filter(Boolean)
    .sort((a, b) => b.scores.total - a.scores.total);

  const prefWindowMeta = {
    label:     lead.timeWindowPreference || 'AT',
    startTime: fmtTime12h(prefWindow.start),
    endTime:   fmtTime12h(prefWindow.end),
  };

  // NH: return no-safe-route result if Alex Gray is absent or only unsafe insertions
  if (routeArea === 'new_hampshire') {
    const noSafeRoute =
      eligibleTechs.length === 0 ||
      scored.length === 0 ||
      !scored[0].bestInsertion?.eodSafe;
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
    })),
  };
}
