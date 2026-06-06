/**
 * Travel-time abstraction for Route Finder scoring.
 * Default provider uses haversine distance + speed heuristics (estimated).
 */

const EARTH_RADIUS_MI = 3958.8;

const SPEED_PROFILES = {
  urban: 22,
  suburban: 30,
  highway: 45,
};

function toRad(d) {
  return (d * Math.PI) / 180;
}

/** Great-circle distance in miles between two lat/lng points. */
export function haversineMiles(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickSpeedMph(miles) {
  if (miles < 2) return SPEED_PROFILES.urban;
  if (miles < 8) return SPEED_PROFILES.suburban;
  return SPEED_PROFILES.highway;
}

/** Estimated drive minutes from straight-line miles. */
export function travelMinutesFromMiles(miles) {
  if (!miles || miles <= 0) return 0;
  return (miles / pickSpeedMph(miles)) * 60;
}

function normalizePoint(point) {
  if (!point || point.lat == null || point.lng == null) return null;
  return { lat: point.lat, lng: point.lng };
}

/**
 * @typedef {Object} TravelSegmentResult
 * @property {number} distanceMiles
 * @property {number} travelMinutes
 * @property {string} provider
 * @property {'estimated' | 'road'} accuracy
 * @property {string[]} warnings
 */

export const HaversineTravelTimeProvider = {
  getProviderName() {
    return 'haversine';
  },

  getProviderAccuracy() {
    return 'estimated';
  },

  /**
   * @param {{ lat: number, lng: number }} origin
   * @param {{ lat: number, lng: number }} destination
   * @returns {TravelSegmentResult}
   */
  getDistanceMiles(origin, destination) {
    const a = normalizePoint(origin);
    const b = normalizePoint(destination);
    if (!a || !b) {
      return {
        distanceMiles: 0,
        travelMinutes: 0,
        provider: 'haversine',
        accuracy: 'estimated',
        warnings: ['Missing coordinates for distance calculation'],
      };
    }
    const distanceMiles = haversineMiles(a.lat, a.lng, b.lat, b.lng);
    return {
      distanceMiles,
      travelMinutes: travelMinutesFromMiles(distanceMiles),
      provider: 'haversine',
      accuracy: 'estimated',
      warnings: ['Drive time is estimated using distance, not road-based routing'],
    };
  },

  getTravelMinutes(origin, destination) {
    return this.getDistanceMiles(origin, destination).travelMinutes;
  },

  /**
   * Pairwise matrix for ordered stops (includes leg from each stop to next).
   * @param {Array<{ lat?: number, lng?: number }>} stops
   */
  getRouteMatrix(stops) {
    const legs = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const seg = this.getDistanceMiles(stops[i], stops[i + 1]);
      legs.push(seg);
    }
    return {
      legs,
      provider: 'haversine',
      accuracy: 'estimated',
      warnings: ['Drive time is estimated using distance, not road-based routing'],
    };
  },
};

/** Default singleton used by the scorer. */
export const defaultTravelProvider = HaversineTravelTimeProvider;
