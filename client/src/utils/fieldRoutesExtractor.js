/**
 * FieldRoutes day.php payload extractor.
 * Converts raw route payload into normalized schedule JSON.
 */

import { inferAppointmentDurationMinutes } from './routeServiceDurationRules.js';

/**
 * Convert a time string like "08:00:00", "8:00", or integer minutes to
 * minutes from midnight. Returns null if unparseable.
 */
function timeToMinutes(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  // Already a plain number (minutes from midnight)
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const parts = str.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(str) {
  if (!str) return str;
  return String(str).replace(/<[^>]+>/g, '').trim();
}

/**
 * Replace <br /> variants with ", " and collapse whitespace.
 */
function normalizeAddressFragment(str) {
  if (!str) return '';
  return str.replace(/<br\s*\/?>/gi, ', ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert minutes-from-midnight integer to "HH:MM:SS" string.
 * Passes through strings unchanged.
 */
function minutesToTimeString(val) {
  if (val == null) return null;
  if (typeof val === 'string' && val.includes(':')) return val;
  const mins = typeof val === 'number' ? val : parseInt(val, 10);
  if (isNaN(mins)) return String(val);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * An appointment is "full" if it has address, coordinates, and serviceDescription.
 * Used to resolve duplicates — prefer full records over overflow stubs.
 */
function isFullAppointment(appt) {
  return !!(appt.address && (appt.lat != null || appt.lng != null) && appt.serviceDescription);
}

/**
 * Build a normalized stop object from an appointment record + spot metadata.
 */
function buildStop(appt, spotStart, spotTime, routeOrder) {
  const lat = appt.lat != null ? parseFloat(appt.lat) : null;
  const lng = appt.lng != null ? parseFloat(appt.lng) : null;

  // Bug A fix: streetAddressRaw from FieldRoutes already contains "Street<br />City, ST ZIP".
  // After normalizing <br /> the city/state/zip is already in rawAddr — don't append again.
  const rawAddr = normalizeAddressFragment(appt.address || '');
  const cityStateZip = [appt.city, `${appt.state || ''} ${appt.zip || ''}`.trim()]
    .filter(Boolean).join(', ');
  const fullAddress = (cityStateZip && !rawAddr.endsWith(cityStateZip))
    ? [rawAddr, cityStateZip].filter(Boolean).join(', ').trim()
    : rawAddr;

  const firstName = appt.fname || appt.customerName || '';
  const lastName = appt.lname || appt.customerLastName || '';
  const customerName = [firstName, lastName].filter(Boolean).join(' ').trim();

  // Bug C fix: deduplicate notes — if notes and aptNotes are the same string, only keep one.
  const noteParts = [...new Set(
    [appt.notes, appt.aptNotes].map(n => (n || '').trim()).filter(Boolean)
  )];
  const notes = noteParts.join(' | ') || null;

  const aptStartMinutes = timeToMinutes(appt.aptStart ?? appt.startTime);
  const aptEndMinutes = timeToMinutes(appt.aptEnd ?? appt.endTime);

  // Bug E fix: aptStart/aptEnd arrive as minute integers in the real payload — format to HH:MM:SS.
  const startTime = minutesToTimeString(appt.aptStart ?? appt.startTime);
  const endTime = minutesToTimeString(appt.aptEnd ?? appt.endTime);

  const durationMeta = inferAppointmentDurationMinutes({
    duration: appt.duration,
    serviceType: appt.serviceDescription,
    serviceCode: appt.abbreviation,
    serviceDescription: appt.serviceDescription,
    appointmentType: appt.appointmentType,
    tags: appt.tags,
    notes: noteParts.join(' '),
    status: appt.statusText,
  });

  return {
    appointmentId: String(appt.appointmentID),
    customerId: String(appt.customerID),
    customerName,
    companyName: appt.companyName || null,
    address: fullAddress,
    streetAddressRaw: appt.address || null,
    city: appt.city || null,
    state: appt.state || null,
    zip: appt.zip || null,
    lat,
    lng,
    serviceType: appt.serviceDescription || null,
    serviceCode: appt.abbreviation || null,
    durationMinutes: durationMeta.durationMinutes,
    durationConfidence: durationMeta.confidence,
    durationSource: durationMeta.source,
    durationRuleId: durationMeta.ruleId,
    timeWindow: appt.timeWindow || null,
    startTime,
    endTime,
    aptStartMinutes,
    aptEndMinutes,
    spotStartMinutes: spotStart,
    spotTime: spotTime || null,
    routeOrder,
    callAhead: appt.callAhead ? appt.callAhead.trim() : null,  // Bug D fix: trim leading space
    notes,
    status: appt.statusText || null,
    isCommercial: Boolean(appt.isCommercialAccount),
  };
}

/**
 * Extract and normalize a FieldRoutes day.php AJAX payload.
 *
 * @param {Object} raw - Raw payload object
 * @returns {{ result: Object, stats: Object }}
 */
export function extractRoutePayload(raw) {
  const stats = {
    routesFound: 0,
    routesWithStops: 0,
    stopsExtracted: 0,
    duplicatesRemoved: 0,
    missingFields: new Set(),
  };

  const technicians = [];

  for (const route of (raw.routesData || [])) {
    stats.routesFound++;

    // Map appointmentID → { appt, spotStart, spotTime }
    // First encounter wins unless a later duplicate is more complete
    const appointmentMap = new Map();

    for (const spot of (route.spotsData || [])) {
      const appts = spot.appointmentsData;
      if (!appts || appts.length === 0) continue;

      const spotStart = timeToMinutes(spot.spotStart) ?? 0;
      const spotTime = spot.spotTime || '';

      for (const appt of appts) {
        const id = appt.appointmentID != null ? String(appt.appointmentID) : null;
        if (!id) continue;

        if (appointmentMap.has(id)) {
          const existing = appointmentMap.get(id);
          // Replace only if incoming is full and existing is not
          if (isFullAppointment(appt) && !isFullAppointment(existing.appt)) {
            appointmentMap.set(id, { appt, spotStart, spotTime });
          }
          stats.duplicatesRemoved++;
        } else {
          appointmentMap.set(id, { appt, spotStart, spotTime });
        }
      }
    }

    if (appointmentMap.size === 0) continue;
    stats.routesWithStops++;

    // Sort by spotStartMinutes then appointmentID, assign routeOrder
    const sorted = Array.from(appointmentMap.values()).sort((a, b) => {
      if (a.spotStart !== b.spotStart) return a.spotStart - b.spotStart;
      return Number(a.appt.appointmentID) - Number(b.appt.appointmentID);
    });

    const stops = sorted.map(({ appt, spotStart, spotTime }, idx) => {
      if (!appt.lat && !appt.lng) stats.missingFields.add('lat/lng');
      if (!appt.serviceDescription) stats.missingFields.add('serviceDescription');
      if (!appt.timeWindow) stats.missingFields.add('timeWindow');
      if (!appt.address) stats.missingFields.add('address');
      stats.stopsExtracted++;
      return buildStop(appt, spotStart, spotTime, idx + 1);
    });

    technicians.push({
      techName: route.techName || null,
      techId: String(route.assignedTech ?? ''),
      routeId: String(route.routeID ?? ''),
      routeTitle: route.techTitle || 'Regular Route',
      startLocation: {
        lat: route.startLat != null ? parseFloat(route.startLat) : null,
        lng: route.startLng != null ? parseFloat(route.startLng) : null,
      },
      endLocation: {
        lat: route.endLat != null ? parseFloat(route.endLat) : null,
        lng: route.endLng != null ? parseFloat(route.endLng) : null,
      },
      estimatedTotalDuration: stripHtml(route.estimatedTotalDurationDisplay) || null,
      totalDistanceMiles: route.distanceScore != null ? stripHtml(String(route.distanceScore)) : null,
      routeStopCount: appointmentMap.size,
      routeDurationCapacityRaw: route.routeDurationCapacity || null,
      stops,
    });
  }

  return {
    result: {
      date: raw.date ?? null,
      groupID: raw.groupID ?? null,
      technicians,
    },
    stats: {
      routesFound: stats.routesFound,
      routesWithStops: stats.routesWithStops,
      stopsExtracted: stats.stopsExtracted,
      duplicatesRemoved: stats.duplicatesRemoved,
      missingFields: Array.from(stats.missingFields),
    },
  };
}
