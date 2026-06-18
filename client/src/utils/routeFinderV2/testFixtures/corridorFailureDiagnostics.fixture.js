/**
 * Partial-route fixture shaped like 2026-06-04/05 calibration days.
 * Used only for corridor failure score diagnostics when disk cache is absent.
 */

function makeStop({
  id, address, lat, lng, spotStart = 480, duration = 30, routeOrder,
}) {
  return {
    appointmentId: id,
    customerName: `Stop ${id}`,
    lat,
    lng,
    address,
    spotStartMinutes: spotStart,
    durationMinutes: duration,
    routeOrder,
  };
}

function makeTech({ id, name, routeId, stops, capacityRaw = '4.0 / 10.5' }) {
  const start = stops[0] ?? { lat: 43.66, lng: -70.26 };
  return {
    techId: id,
    techName: name,
    routeId,
    stops,
    startLocation: { lat: start.lat, lng: start.lng },
    endLocation: { lat: start.lat, lng: start.lng },
    routeDurationCapacityRaw: capacityRaw,
  };
}

function buildCorridorRoutePayload(date) {
  return {
    date,
    source: 'corridor-failure-diagnostics-fixture',
    technicians: [
      makeTech({
        id: 1,
        name: 'Patrick Carney',
        routeId: `R-${date}-PC`,
        stops: [
          makeStop({ id: 101, address: '12 Old Orchard St, Old Orchard Beach, ME', lat: 43.5172, lng: -70.3779, spotStart: 480, routeOrder: 1 }),
          makeStop({ id: 102, address: '30 Ocean Park Rd, Old Orchard Beach, ME', lat: 43.5041, lng: -70.3955, spotStart: 540, routeOrder: 2 }),
          makeStop({ id: 103, address: '55 Main St, Saco, ME', lat: 43.5009, lng: -70.4428, spotStart: 600, routeOrder: 3 }),
        ],
      }),
      makeTech({
        id: 2,
        name: 'Ian Pratt',
        routeId: `R-${date}-IP`,
        stops: [
          makeStop({ id: 201, address: '220 US Route 1, Scarborough, ME', lat: 43.5781, lng: -70.3229, spotStart: 480, routeOrder: 1 }),
          makeStop({ id: 202, address: '50 Broadway, South Portland, ME', lat: 43.6415, lng: -70.2409, spotStart: 540, routeOrder: 2 }),
          makeStop({ id: 203, address: '100 Congress St, Portland, ME', lat: 43.6591, lng: -70.2568, spotStart: 600, routeOrder: 3 }),
        ],
        capacityRaw: '7.5 / 10.5',
      }),
      makeTech({
        id: 3,
        name: 'Jack Johnson',
        routeId: `R-${date}-JJ`,
        stops: [
          makeStop({ id: 301, address: '123 Main St, Kennebunk, ME', lat: 43.3845, lng: -70.5448, spotStart: 480, routeOrder: 1 }),
          makeStop({ id: 302, address: '55 Main St, Saco, ME', lat: 43.5009, lng: -70.4428, spotStart: 540, routeOrder: 2 }),
          makeStop({ id: 303, address: '8 Black Point Rd, Scarborough, ME', lat: 43.5471, lng: -70.3197, spotStart: 600, routeOrder: 3 }),
        ],
      }),
      makeTech({
        id: 4,
        name: 'Paige Bullock',
        routeId: `R-${date}-PB`,
        stops: [
          makeStop({ id: 401, address: '100 Main St, Westbrook, ME', lat: 43.6770, lng: -70.3712, spotStart: 480, routeOrder: 1 }),
          makeStop({ id: 402, address: '44 Main St, Gorham, ME', lat: 43.6795, lng: -70.4448, spotStart: 540, routeOrder: 2 }),
          makeStop({ id: 403, address: '1 Commercial St, Portland, ME', lat: 43.6562, lng: -70.2504, spotStart: 600, routeOrder: 3 }),
        ],
        capacityRaw: '6.5 / 10.5',
      }),
      makeTech({
        id: 5,
        name: 'Chris McGary',
        routeId: `R-${date}-CM`,
        stops: [
          makeStop({ id: 501, address: '44 Main St, Gorham, ME', lat: 43.6795, lng: -70.4448, spotStart: 480, routeOrder: 1 }),
          makeStop({ id: 502, address: '19 New Portland Rd, Gorham, ME', lat: 43.6827, lng: -70.4586, spotStart: 540, routeOrder: 2 }),
          makeStop({ id: 503, address: '35 Ossipee Trail W, Standish, ME', lat: 43.7350, lng: -70.5511, spotStart: 600, routeOrder: 3 }),
        ],
      }),
      makeTech({
        id: 6,
        name: 'Skyler Ruest',
        routeId: `R-${date}-SR`,
        stops: [
          makeStop({ id: 601, address: '35 Main St, Freeport, ME', lat: 43.8570, lng: -70.1031, spotStart: 480, routeOrder: 1 }),
          makeStop({ id: 602, address: '770 Roosevelt Trail, Windham, ME', lat: 43.8370, lng: -70.4387, spotStart: 540, routeOrder: 2 }),
          makeStop({ id: 603, address: '20 Main St, Yarmouth, ME', lat: 43.8006, lng: -70.1867, spotStart: 600, routeOrder: 3 }),
        ],
      }),
    ],
  };
}

/** @type {Record<string, { technicians: unknown[], date: string, source: string }>} */
export const CORRIDOR_DIAGNOSTIC_ROUTE_PAYLOADS = {
  '2026-06-04': buildCorridorRoutePayload('2026-06-04'),
  '2026-06-05': buildCorridorRoutePayload('2026-06-05'),
};

export const CORRIDOR_FAILURE_EXAMPLE_IDS = [
  'scarborough-iq-example-016',
  'scarborough-tm-example-017',
  'old-orchard-tm-example-013',
  'old-orchard-iq-example-012',
  'windham-general-example-024',
];

/**
 * Dispatcher-confirmed winning technicians for the five remaining high-confidence mistakes.
 * @type {Record<string, string>}
 */
export const CORRIDOR_CONFIRMED_WINNERS = {
  'scarborough-iq-example-016': 'Patrick Carney',
  'scarborough-tm-example-017': 'Jack Johnson',
  'old-orchard-tm-example-013': 'Paige Bullock',
  'old-orchard-iq-example-012': 'Paige Bullock',
  'windham-general-example-024': 'Skyler Ruest',
};
