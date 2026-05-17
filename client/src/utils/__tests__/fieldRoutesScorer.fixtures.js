/**
 * Test fixtures for fieldRoutesScorer.js
 * Covers all canonical scenarios: NH routing, exclusions, clusters,
 * timed anchors, capacity, before-first insertion, end-of-route cluster.
 *
 * Coordinates are real ME/NH town centers for geographic realism.
 */

function makeStop({
  id, name, lat, lng, address, spotStart, duration = 30,
  startTime = null, endTime = null, routeOrder = 0,
}) {
  return {
    appointmentId: id,
    customerName: name,
    lat, lng,
    address: address || `${name}, ME`,
    spotStartMinutes: spotStart,
    durationMinutes: duration,
    startTime,
    endTime,
    routeOrder,
  };
}

function makeTech({
  id = 99, name, routeId = 'R001', stops,
  startLat = null, startLng = null,
  endLat = null, endLng = null,
  capacityRaw = '3.5 / 10.5',
}) {
  return {
    techId: id,
    techName: name,
    routeId,
    stops,
    startLocation: startLat != null ? { lat: startLat, lng: startLng } : null,
    endLocation: endLat != null ? { lat: endLat, lng: endLng } : null,
    routeDurationCapacityRaw: capacityRaw,
  };
}

// ---------------------------------------------------------------------------
// Scenario: Maine MWF coastal cluster
// Tech has 5 stops in the Wells/Kennebunk coastal zone (all <5 mi apart).
// Lead is nearby; date is a Monday → routeAreaBonus should fire.
// ---------------------------------------------------------------------------
const MAINE_STOPS = [
  makeStop({ id: 1, name: 'Acme Pest Wells',      lat: 43.322, lng: -70.584, spotStart: 480,  routeOrder: 1 }),
  makeStop({ id: 2, name: 'Baker Home',           lat: 43.340, lng: -70.555, spotStart: 540,  routeOrder: 2 }),
  makeStop({ id: 3, name: 'Clark Residence',      lat: 43.360, lng: -70.530, spotStart: 600,  routeOrder: 3 }),
  makeStop({ id: 4, name: 'Dunbar Property',      lat: 43.384, lng: -70.510, spotStart: 660,  routeOrder: 4 }),
  makeStop({ id: 5, name: 'Evans Cottage Kennebunk', lat: 43.400, lng: -70.490, spotStart: 720, routeOrder: 5 }),
];

export const maineMwfCluster = {
  technicians: [
    makeTech({
      id: 1, name: 'Chris Adams', routeId: 'R-ME01',
      stops: MAINE_STOPS,
      startLat: 43.300, startLng: -70.600,
      endLat:   43.420, endLng:   -70.470,
    }),
  ],
  lead: {
    lat: 43.350, lng: -70.545,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AM',
    routeArea: 'maine',
    date: '2026-05-18', // Monday
  },
};

// ---------------------------------------------------------------------------
// Scenario: NH approved tech (Alex Gray) — should route successfully
// ---------------------------------------------------------------------------
const NH_SEACOAST_STOPS = [
  makeStop({ id: 10, name: 'Seacoast Home 1', lat: 43.072, lng: -70.763, spotStart: 480, routeOrder: 1 }),
  makeStop({ id: 11, name: 'Seacoast Home 2', lat: 43.090, lng: -70.740, spotStart: 540, routeOrder: 2 }),
  makeStop({ id: 12, name: 'Seacoast Home 3', lat: 43.110, lng: -70.720, spotStart: 600, routeOrder: 3 }),
  makeStop({ id: 13, name: 'Seacoast Home 4', lat: 43.130, lng: -70.700, spotStart: 660, routeOrder: 4 }),
];

export const nhApprovedTech = {
  technicians: [
    makeTech({
      id: 10068, name: 'Alex Gray', routeId: 'R-NH01',
      stops: NH_SEACOAST_STOPS,
      startLat: 43.060, startLng: -70.780,
    }),
  ],
  lead: {
    lat: 43.100, lng: -70.730,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AM',
    routeArea: 'new_hampshire',
    date: '2026-05-18',
  },
};

// ---------------------------------------------------------------------------
// Scenario: NH lead with only non-approved tech → noSafeRoute: true
// ---------------------------------------------------------------------------
export const nhNoApprovedTech = {
  technicians: [
    makeTech({
      id: 55, name: 'Bob Smith', routeId: 'R-NH02',
      stops: NH_SEACOAST_STOPS,
    }),
  ],
  lead: {
    lat: 43.100, lng: -70.730,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AM',
    routeArea: 'new_hampshire',
    date: '2026-05-18',
  },
};

// ---------------------------------------------------------------------------
// Scenario: Route with two timed anchors — tests anchor constraint handling
// Stop 2 (10:00–11:00) and stop 4 (14:00–15:00) are timed anchors.
// ---------------------------------------------------------------------------
const TIMED_STOPS = [
  makeStop({ id: 20, name: 'Free Stop A',    lat: 43.493, lng: -70.453, spotStart: 480, routeOrder: 1 }),
  makeStop({ id: 21, name: 'Timed Anchor 1', lat: 43.480, lng: -70.470, spotStart: 540,
    startTime: '09:00', endTime: '11:00', routeOrder: 2 }),
  makeStop({ id: 22, name: 'Free Stop B',    lat: 43.466, lng: -70.485, spotStart: 630, routeOrder: 3 }),
  makeStop({ id: 23, name: 'Timed Anchor 2', lat: 43.450, lng: -70.500, spotStart: 780,
    startTime: '13:00', endTime: '15:00', routeOrder: 4 }),
  makeStop({ id: 24, name: 'Free Stop C',    lat: 43.435, lng: -70.515, spotStart: 870, routeOrder: 5 }),
];

export const twoTimedAnchors = {
  technicians: [
    makeTech({
      id: 2, name: 'Dave Wilson', routeId: 'R-TM01',
      stops: TIMED_STOPS,
      startLat: 43.503, startLng: -70.440,
    }),
  ],
  lead: {
    lat: 43.470, lng: -70.478,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AM',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

// ---------------------------------------------------------------------------
// Scenario: Excluded tech (Leo) — should result in topMatches: []
// ---------------------------------------------------------------------------
export const excludedLeo = {
  technicians: [
    makeTech({
      id: 77, name: 'Leo Johnson', routeId: 'R-EX01',
      stops: MAINE_STOPS,
    }),
  ],
  lead: {
    lat: 43.350, lng: -70.545,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AT',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

// ---------------------------------------------------------------------------
// Scenario: Fully booked tech — remainingHours = 0
// ---------------------------------------------------------------------------
export const fullyBookedTech = {
  technicians: [
    makeTech({
      id: 3, name: 'Sarah Lee', routeId: 'R-FB01',
      stops: MAINE_STOPS,
      capacityRaw: '10.5 / 10.5',
    }),
  ],
  lead: {
    lat: 43.350, lng: -70.545,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AT',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

// ---------------------------------------------------------------------------
// Scenario: Missing capacity string — should fall back to DEFAULT_MAX_HOURS
// ---------------------------------------------------------------------------
export const missingCapacity = {
  technicians: [
    makeTech({
      id: 4, name: 'Tom Harris', routeId: 'R-MC01',
      stops: MAINE_STOPS,
      capacityRaw: null,
    }),
  ],
  lead: {
    lat: 43.350, lng: -70.545,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AT',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

// ---------------------------------------------------------------------------
// Scenario: End-of-route cluster — cluster exists but only at end of route.
// Five late-day stops clustered near lead; early stops are far away.
// Best insertion should be mid/end-route despite "end-of-route bias" penalty.
// ---------------------------------------------------------------------------
const END_CLUSTER_STOPS = [
  makeStop({ id: 30, name: 'Morning Stop Far 1', lat: 43.660, lng: -70.255, spotStart: 480, routeOrder: 1 }),
  makeStop({ id: 31, name: 'Morning Stop Far 2', lat: 43.640, lng: -70.270, spotStart: 540, routeOrder: 2 }),
  makeStop({ id: 32, name: 'Cluster Near 1',     lat: 43.322, lng: -70.584, spotStart: 720, routeOrder: 3 }),
  makeStop({ id: 33, name: 'Cluster Near 2',     lat: 43.330, lng: -70.570, spotStart: 780, routeOrder: 4 }),
  makeStop({ id: 34, name: 'Cluster Near 3',     lat: 43.340, lng: -70.560, spotStart: 840, routeOrder: 5 }),
];

export const endOfRouteCluster = {
  technicians: [
    makeTech({
      id: 5, name: 'Nina Park', routeId: 'R-EC01',
      stops: END_CLUSTER_STOPS,
      startLat: 43.680, startLng: -70.240,
    }),
  ],
  lead: {
    lat: 43.332, lng: -70.572,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'PM',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

// ---------------------------------------------------------------------------
// Scenario: Before-first insertion — lead fits best before first stop.
// All route stops are in the afternoon; lead is AM preference.
// ---------------------------------------------------------------------------
const AFTERNOON_STOPS = [
  makeStop({ id: 40, name: 'Afternoon Stop 1', lat: 43.384, lng: -70.545, spotStart: 720, routeOrder: 1 }),
  makeStop({ id: 41, name: 'Afternoon Stop 2', lat: 43.370, lng: -70.530, spotStart: 810, routeOrder: 2 }),
  makeStop({ id: 42, name: 'Afternoon Stop 3', lat: 43.355, lng: -70.515, spotStart: 900, routeOrder: 3 }),
];

export const beforeFirstInsertion = {
  technicians: [
    makeTech({
      id: 6, name: 'Mike Torres', routeId: 'R-BF01',
      stops: AFTERNOON_STOPS,
      startLat: 43.400, startLng: -70.560,
    }),
  ],
  lead: {
    lat: 43.390, lng: -70.555,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AM',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

// ---------------------------------------------------------------------------
// Scenario: General happy path — used by contract test (always produces a result)
// ---------------------------------------------------------------------------
export const generalHappyPath = {
  technicians: [
    makeTech({
      id: 99, name: 'Alex Smith', routeId: 'R-GP01',
      stops: MAINE_STOPS,
      startLat: 43.300, startLng: -70.600,
      endLat:   43.420, endLng:   -70.470,
    }),
  ],
  lead: {
    lat: 43.350, lng: -70.545,
    serviceType: 'Regular Service',
    durationMinutes: 30,
    timeWindowPreference: 'AM',
    routeArea: 'general',
    date: '2026-05-19',
  },
};

export const ALL_FIXTURES = {
  maineMwfCluster,
  nhApprovedTech,
  nhNoApprovedTech,
  twoTimedAnchors,
  excludedLeo,
  fullyBookedTech,
  missingCapacity,
  endOfRouteCluster,
  beforeFirstInsertion,
  generalHappyPath,
};
