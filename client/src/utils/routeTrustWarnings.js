/**
 * Trust warnings and confidence labels for Route Finder recommendations.
 */

import { computeRouteCostImpact } from './routeCostImpact.js';

/** @typedef {'High' | 'Medium' | 'Low'} ConfidenceLabel */

/**
 * @typedef {Object} TrustWarning
 * @property {string} code
 * @property {string} badge
 * @property {string} message
 * @property {'info' | 'caution' | 'risk'} severity
 */

/**
 * @param {Object} match - Scored route match
 * @param {Object} lead - Lead object
 * @param {Object} [ctx]
 * @param {Object} [ctx.tech] - Original technician payload
 * @param {Object} [ctx.travelProvider]
 */
export function buildTrustWarnings(match, lead, ctx = {}) {
  const warnings = /** @type {TrustWarning[]} */ ([]);
  const ins = match.bestInsertion;
  const tech = ctx.tech;
  const stops = tech?.stops ?? match.routeStops?.filter(s => !s.isNew) ?? [];

  const diagnostics = ctx.travelDiagnostics || match.travelDiagnostics;
  const providerAccuracy = diagnostics?.travelAccuracy
    || ctx.travelProvider?.getProviderAccuracy?.()
    || match.travelAccuracy
    || 'estimated';

  if (providerAccuracy !== 'road-based' || diagnostics?.fallbackUsed) {
    const reason = diagnostics?.fallbackReason;
    warnings.push({
      code: 'estimated_drive_time',
      badge: 'Estimated straight-line timing',
      message: reason === 'missing_api_key'
        ? 'Road-based drive time unavailable — GOOGLE_ROUTES_API_KEY is not configured on the server. Using estimated straight-line distance.'
        : 'Road-based drive time unavailable; using estimated straight-line distance.',
      severity: 'info',
    });
  } else {
    warnings.push({
      code: 'road_based_drive_time',
      badge: 'Road-based timing',
      message: 'Drive time and arrival estimates use Google road-based routing.',
      severity: 'info',
    });
  }

  const withCoords = stops.filter(s => s.lat != null && s.lng != null);
  const coordCoverage = stops.length ? withCoords.length / stops.length : 1;
  if (coordCoverage < 0.6) {
    warnings.push({
      code: 'missing_coordinates',
      badge: 'Missing route data',
      message: 'Several stops on this route are missing map coordinates, so proximity and timing are less reliable.',
      severity: 'risk',
    });
  } else if (coordCoverage < 0.9) {
    warnings.push({
      code: 'partial_coordinates',
      badge: 'Partial route data',
      message: 'Some stops lack coordinates; verify the route on the map before booking.',
      severity: 'caution',
    });
  }

  if (tech && !tech.startLocation?.lat && !tech.endLocation?.lat) {
    warnings.push({
      code: 'missing_start_end',
      badge: 'Unknown tech start/end',
      message: 'Technician start or end location is not available from FieldRoutes.',
      severity: 'info',
    });
  }

  if (lead?.durationConfidence === 'estimated') {
    warnings.push({
      code: 'estimated_duration',
      badge: 'Estimated job duration',
      message: `Service duration (${lead.durationMinutes} min) is a standard estimate for ${lead.serviceLabel || lead.serviceType}.`,
      severity: 'info',
    });
  }

  if (lead?.durationConfidence === 'custom') {
    warnings.push({
      code: 'custom_duration',
      badge: 'Custom duration',
      message: 'This recommendation uses a manually entered service duration.',
      severity: 'caution',
    });
  }

  const cap = match.capacity;
  if (!cap || cap.maxHours <= 0) {
    warnings.push({
      code: 'missing_capacity',
      badge: 'Capacity unknown',
      message: 'Route capacity data was not available; confirm the technician has time before booking.',
      severity: 'caution',
    });
  } else if (cap.remainingHours < (lead?.durationMinutes ?? 30) / 60) {
    warnings.push({
      code: 'capacity_warning',
      badge: 'Capacity warning',
      message: 'This route may be at or over its scheduled capacity for the day.',
      severity: 'risk',
    });
  }

  if (ins?.timedRisk === 'medium' || ins?.timedRisk === 'high') {
    warnings.push({
      code: 'timed_stop_risk',
      badge: 'Timed stop risk',
      message: ins.timedSafetyLabel || 'Timed appointments on this route may be affected.',
      severity: ins.timedRisk === 'high' ? 'risk' : 'caution',
    });
  } else if (ins?.timedRisk === 'low') {
    warnings.push({
      code: 'timed_stop_tight',
      badge: 'Tight timed buffer',
      message: ins.timedSafetyLabel || 'Timing buffer before the next timed appointment is limited.',
      severity: 'caution',
    });
  }

  const pref = lead?.timeWindowPreference;
  if (pref && pref !== 'AM' && pref !== 'PM' && pref !== 'AT') {
    warnings.push({
      code: 'narrow_window',
      badge: 'Specific window',
      message: 'A narrow customer window was selected; confirm arrival time with the technician.',
      severity: 'info',
    });
  }

  if (ins?.detourMiles != null && ins.detourMiles > 8) {
    warnings.push({
      code: 'large_detour',
      badge: 'Large detour',
      message: `Insertion adds about ${ins.detourMiles} miles compared to the direct route segment.`,
      severity: 'caution',
    });
  }

  return warnings;
}

/**
 * @returns {ConfidenceLabel}
 */
export function computeConfidenceLabel(match, lead, warnings) {
  const ins = match.bestInsertion;
  let score = 0;

  const hasRisk = warnings.some(w => w.severity === 'risk');
  const hasCaution = warnings.some(w => w.severity === 'caution');

  if (match.clusterDensity >= 2) score += 2;
  if (ins?.detourMiles != null && ins.detourMiles <= 3) score += 2;
  if (ins?.timedRisk === 'none') score += 2;
  if (lead?.durationConfidence === 'standard') score += 1;
  if (match.capacity?.remainingHours > 1) score += 1;
  if (ins?.optimizationConfidence === 'High') score += 2;
  else if (ins?.optimizationConfidence === 'Medium') score += 1;

  if (hasRisk) score -= 4;
  if (hasCaution) score -= 2;
  if (warnings.some(w => w.code === 'estimated_drive_time')) score -= 1;
  if (ins?.detourMiles != null && ins.detourMiles > 8) score -= 2;

  if (score >= 5) return 'High';
  if (score >= 2) return 'Medium';
  return 'Low';
}

export function enrichMatchWithTrustAndCost(match, lead, ctx = {}) {
  const warnings = buildTrustWarnings(match, lead, ctx);
  const confidenceLabel = computeConfidenceLabel(match, lead, warnings);
  const addedMiles = match.bestInsertion?.detourMiles ?? 0;
  const addedDriveMinutes = match.bestInsertion?.addedDriveMinutes ?? 0;
  const costImpact = computeRouteCostImpact({ addedMiles, addedDriveMinutes });

  const clusterStrong = match.clusterDensity >= 3;
  const badges = [];
  if (warnings.some(w => w.code === 'estimated_drive_time')) badges.push('Estimated drive time');
  if (clusterStrong) badges.push('Strong route fit');
  if (warnings.some(w => w.code === 'capacity_warning')) badges.push('Capacity warning');
  if (warnings.some(w => w.code === 'missing_coordinates' || w.code === 'partial_coordinates')) {
    badges.push('Missing route data');
  }
  if (warnings.some(w => w.code === 'timed_stop_risk' || w.code === 'timed_stop_tight')) {
    badges.push('Timed stop risk');
  }
  if (confidenceLabel === 'Low') badges.push('Low confidence');

  return {
    ...match,
    trustWarnings: warnings,
    confidenceLabel,
    trustBadges: badges,
    costImpact,
  };
}
