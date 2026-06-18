/**
 * Mock scraped FieldRoutes route payload for calibration tests.
 * Mirrors normalized cache shape without requiring live scrape or disk cache.
 */

function makeStop({
  id, name, lat, lng, address, spotStart, duration = 30, routeOrder,
}) {
  return {
    appointmentId: id,
    customerName: name,
    lat,
    lng,
    address: address || `${name}, ME`,
    spotStartMinutes: spotStart,
    durationMinutes: duration,
    routeOrder,
  };
}

function makeTech({ id, name, routeId, stops, startLat, startLng, capacityRaw = '3.5 / 10.5' }) {
  return {
    techId: id,
    techName: name,
    routeId,
    stops,
    startLocation: startLat != null ? { lat: startLat, lng: startLng } : null,
    endLocation: startLat != null ? { lat: startLat, lng: startLng } : null,
    routeDurationCapacityRaw: capacityRaw,
  };
}

const KENNEBUNK_CLUSTER = [
  makeStop({ id: 1, name: 'Kennebunk A', lat: 43.384, lng: -70.545, spotStart: 480, routeOrder: 1 }),
  makeStop({ id: 2, name: 'Kennebunk B', lat: 43.388, lng: -70.540, spotStart: 540, routeOrder: 2 }),
  makeStop({ id: 3, name: 'Kennebunk C', lat: 43.392, lng: -70.535, spotStart: 600, routeOrder: 3 }),
];

const PORTLAND_CLUSTER = [
  makeStop({ id: 10, name: 'Portland A', lat: 43.660, lng: -70.255, spotStart: 480, routeOrder: 1 }),
  makeStop({ id: 11, name: 'Portland B', lat: 43.665, lng: -70.250, spotStart: 540, routeOrder: 2 }),
  makeStop({ id: 12, name: 'Portland C', lat: 43.670, lng: -70.245, spotStart: 600, routeOrder: 3 }),
  makeStop({ id: 13, name: 'Portland D', lat: 43.675, lng: -70.240, spotStart: 660, routeOrder: 4 }),
  makeStop({ id: 14, name: 'Portland E', lat: 43.680, lng: -70.235, spotStart: 720, routeOrder: 5 }),
];

/** @type {Record<string, { technicians: unknown[], date: string, source: string }>} */
export const MOCK_REAL_ROUTE_PAYLOADS = {
  '2026-06-17': {
    date: '2026-06-17',
    source: 'mock-calibration-fixture',
    technicians: [
      makeTech({
        id: 101,
        name: 'Joseph Willey',
        routeId: 'R-MOCK-JW',
        stops: KENNEBUNK_CLUSTER,
        startLat: 43.380,
        startLng: -70.550,
      }),
      makeTech({
        id: 102,
        name: 'Ian Pratt',
        routeId: 'R-MOCK-IP',
        stops: PORTLAND_CLUSTER,
        startLat: 43.655,
        startLng: -70.260,
        capacityRaw: '8.0 / 10.5',
      }),
      makeTech({
        id: 103,
        name: 'Paige Bullock',
        routeId: 'R-MOCK-PB',
        stops: PORTLAND_CLUSTER,
        startLat: 43.655,
        startLng: -70.260,
        capacityRaw: '7.5 / 10.5',
      }),
    ],
  },
  '2026-06-18': {
    date: '2026-06-18',
    source: 'mock-calibration-fixture',
    technicians: [
      makeTech({
        id: 201,
        name: 'Joseph Willey',
        routeId: 'R-MOCK-JW-18',
        stops: KENNEBUNK_CLUSTER,
        startLat: 43.380,
        startLng: -70.550,
      }),
      makeTech({
        id: 202,
        name: 'Ian Pratt',
        routeId: 'R-MOCK-IP-18',
        stops: PORTLAND_CLUSTER,
        startLat: 43.655,
        startLng: -70.260,
        capacityRaw: '8.0 / 10.5',
      }),
    ],
  },
};

/**
 * @param {string} date
 * @returns {Promise<{ technicians: unknown[], date: string, source: string }|null>}
 */
export async function loadMockRealRoutesForDate(date) {
  return MOCK_REAL_ROUTE_PAYLOADS[date] ?? null;
}
