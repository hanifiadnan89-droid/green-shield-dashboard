/**
 * Deterministic technician route fixtures for validation baseline reports.
 * Builds per-example candidate pools from expected / acceptable / forbidden tech names.
 */

import { buildLeadFromValidationExample } from '../validationRunner.js';
import { resolveTownFromAddress } from '../profileScoringModifiers.js';

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

function slugTechName(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function stableTechId(name) {
  let hash = 0;
  for (const ch of String(name)) {
    hash = ((hash << 5) - hash) + ch.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash % 900000) + 1000;
}

/**
 * @param {number} leadLat
 * @param {number} leadLng
 * @param {number} count
 * @param {string} townLabel
 * @param {number} latOffset
 * @param {number} lngOffset
 */
function makeClusterStops(leadLat, leadLng, count, townLabel, latOffset = 0, lngOffset = 0) {
  const stops = [];
  for (let i = 0; i < count; i += 1) {
    stops.push(makeStop({
      id: 1000 + i,
      name: `${townLabel} Stop ${i + 1}`,
      lat: leadLat + latOffset + (i * 0.0025),
      lng: leadLng + lngOffset + (i * 0.0020),
      address: `${120 + i} Main St, ${townLabel}, ME`,
      spotStart: 480 + (i * 60),
      routeOrder: i + 1,
    }));
  }
  return stops;
}

/**
 * @param {number} leadLat
 * @param {number} leadLng
 * @param {number} count
 * @param {string} townLabel
 */
function makeDistantStops(leadLat, leadLng, count, townLabel) {
  const farLat = leadLat + 0.42;
  const farLng = leadLng + 0.36;
  const stops = [];
  for (let i = 0; i < count; i += 1) {
    stops.push(makeStop({
      id: 2000 + i,
      name: `${townLabel} Far Stop ${i + 1}`,
      lat: farLat + (i * 0.01),
      lng: farLng + (i * 0.01),
      address: `${300 + i} Congress St, Portland, ME`,
      spotStart: 480 + (i * 60),
      routeOrder: i + 1,
    }));
  }
  return stops;
}

/**
 * @param {import('../validationExamples.js').RouteFinderValidationExample} example
 * @param {string} techName
 * @returns {'expected'|'acceptable'|'forbidden'}
 */
export function resolveValidationTechRole(example, techName) {
  const normalized = String(techName).trim().toLowerCase();
  const expected = String(example.expectedTechName).trim().toLowerCase();
  if (normalized === expected) return 'expected';

  const forbidden = (example.expectedNotTechNames ?? []).some(
    name => String(name).trim().toLowerCase() === normalized,
  );
  if (forbidden) return 'forbidden';

  return 'acceptable';
}

/**
 * @param {import('../validationExamples.js').RouteFinderValidationExample} example
 * @returns {string[]}
 */
export function collectValidationFixtureTechNames(example) {
  const names = new Set([
    example.expectedTechName,
    ...(example.acceptableTechNames ?? []),
    ...(example.expectedNotTechNames ?? []),
  ]);
  return [...names].filter(Boolean);
}

/**
 * @param {import('../validationExamples.js').RouteFinderValidationExample} example
 * @param {object} [lead]
 * @returns {Array<{ techName: string, routeId: string, stops: unknown[] }>}
 */
export function buildDeterministicTechniciansForExample(example, lead = null) {
  const resolvedLead = lead ?? buildLeadFromValidationExample(example);
  const townLabel = resolveTownFromAddress(resolvedLead.address) ?? 'Local';
  const techNames = collectValidationFixtureTechNames(example);

  return techNames.map((techName, index) => {
    const role = resolveValidationTechRole(example, techName);
    let stops;
    let startLat;
    let startLng;
    let capacityRaw = '3.5 / 10.5';

    if (role === 'expected') {
      stops = makeClusterStops(resolvedLead.lat, resolvedLead.lng, 3, townLabel);
      startLat = resolvedLead.lat - 0.004;
      startLng = resolvedLead.lng - 0.004;
    } else if (role === 'acceptable') {
      stops = makeClusterStops(
        resolvedLead.lat,
        resolvedLead.lng,
        4,
        townLabel,
        0.008 + (index * 0.001),
        0.006 + (index * 0.001),
      );
      startLat = resolvedLead.lat + 0.006;
      startLng = resolvedLead.lng + 0.005;
    } else {
      stops = makeDistantStops(resolvedLead.lat, resolvedLead.lng, 5, townLabel);
      startLat = resolvedLead.lat + 0.43;
      startLng = resolvedLead.lng + 0.37;
      capacityRaw = '8.5 / 10.5';
    }

    return makeTech({
      id: stableTechId(techName),
      name: techName,
      routeId: `R-VAL-${slugTechName(techName)}`,
      stops,
      startLat,
      startLng,
      capacityRaw,
    });
  });
}
