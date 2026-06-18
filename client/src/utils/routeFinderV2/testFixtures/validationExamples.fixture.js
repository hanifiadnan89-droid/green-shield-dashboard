/**
 * Deterministic route fixtures for V2 validation harness tests.
 * Not used by live scoring — test/calibration only.
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

function makeTech({ id, name, routeId, stops, startLat, startLng }) {
  return {
    techId: id,
    techName: name,
    routeId,
    stops,
    startLocation: startLat != null ? { lat: startLat, lng: startLng } : null,
    endLocation: startLat != null ? { lat: startLat, lng: startLng } : null,
    routeDurationCapacityRaw: '3.5 / 10.5',
  };
}

const KENNEBUNK_CLUSTER_STOPS = [
  makeStop({
    id: 1,
    name: 'Kennebunk Stop 1',
    lat: 43.382,
    lng: -70.548,
    address: '10 Ocean Ave, Kennebunk, ME',
    spotStart: 480,
    routeOrder: 1,
  }),
  makeStop({
    id: 2,
    name: 'Kennebunk Stop 2',
    lat: 43.388,
    lng: -70.542,
    address: '22 Main St, Kennebunk, ME',
    spotStart: 540,
    routeOrder: 2,
  }),
  makeStop({
    id: 3,
    name: 'Kennebunk Stop 3',
    lat: 43.392,
    lng: -70.536,
    address: '44 Summer St, Kennebunk, ME',
    spotStart: 600,
    routeOrder: 3,
  }),
];

const PORTLAND_AREA_STOPS = [
  makeStop({
    id: 10,
    name: 'Portland Stop 1',
    lat: 43.660,
    lng: -70.255,
    address: '100 Congress St, Portland, ME',
    spotStart: 480,
    routeOrder: 1,
  }),
  makeStop({
    id: 11,
    name: 'Portland Stop 2',
    lat: 43.650,
    lng: -70.265,
    address: '200 Commercial St, Portland, ME',
    spotStart: 540,
    routeOrder: 2,
  }),
  makeStop({
    id: 12,
    name: 'Portland Stop 3',
    lat: 43.640,
    lng: -70.275,
    address: '300 Fore St, Portland, ME',
    spotStart: 600,
    routeOrder: 3,
  }),
  makeStop({
    id: 13,
    name: 'Portland Stop 4',
    lat: 43.630,
    lng: -70.285,
    address: '400 Market St, Portland, ME',
    spotStart: 660,
    routeOrder: 4,
  }),
  makeStop({
    id: 14,
    name: 'Portland Stop 5',
    lat: 43.620,
    lng: -70.295,
    address: '500 Exchange St, Portland, ME',
    spotStart: 720,
    routeOrder: 5,
  }),
];

const WESTBROOK_AREA_STOPS = [
  makeStop({
    id: 20,
    name: 'Westbrook Stop 1',
    lat: 43.680,
    lng: -70.360,
    address: '10 Main St, Westbrook, ME',
    spotStart: 480,
    routeOrder: 1,
  }),
  makeStop({
    id: 21,
    name: 'Westbrook Stop 2',
    lat: 43.670,
    lng: -70.350,
    address: '20 Bridge St, Westbrook, ME',
    spotStart: 540,
    routeOrder: 2,
  }),
  makeStop({
    id: 22,
    name: 'Westbrook Stop 3',
    lat: 43.660,
    lng: -70.340,
    address: '30 Canal St, Westbrook, ME',
    spotStart: 600,
    routeOrder: 3,
  }),
  makeStop({
    id: 23,
    name: 'Westbrook Stop 4',
    lat: 43.650,
    lng: -70.330,
    address: '40 William Clarke Dr, Westbrook, ME',
    spotStart: 660,
    routeOrder: 4,
  }),
  makeStop({
    id: 24,
    name: 'Westbrook Stop 5',
    lat: 43.640,
    lng: -70.320,
    address: '50 Liza Harmon Dr, Westbrook, ME',
    spotStart: 720,
    routeOrder: 5,
  }),
];

/** Kennebunk IQ scenario — Joseph Willey should beat Portland/Westbrook techs. */
export const kennebunkIqValidationFixture = {
  technicians: [
    makeTech({
      id: 1001,
      name: 'Joseph Willey',
      routeId: 'R-KEN-01',
      stops: KENNEBUNK_CLUSTER_STOPS,
      startLat: 43.380,
      startLng: -70.550,
    }),
    makeTech({
      id: 1002,
      name: 'Ian Pratt',
      routeId: 'R-PRT-01',
      stops: PORTLAND_AREA_STOPS,
      startLat: 43.665,
      startLng: -70.250,
    }),
    makeTech({
      id: 1003,
      name: 'Paige Bullock',
      routeId: 'R-WBK-01',
      stops: WESTBROOK_AREA_STOPS,
      startLat: 43.685,
      startLng: -70.365,
    }),
  ],
  lead: {
    lat: 43.3845,
    lng: -70.5448,
    address: '123 Main St, Kennebunk, ME',
    serviceType: 'IQ',
    serviceAbbreviation: 'IQ',
    serviceLabel: 'IQ / Insect Quarterly',
    timeWindowPreference: 'AT',
    routeArea: 'maine',
    date: '2026-06-17',
    durationMinutes: 30,
  },
};
