import {
  getCachedPropertyRecords,
  setCachedPropertyRecords,
} from './rentCastPropertyCache.js';
import {
  getRentCastUsage,
  recordRentCastApiCall,
  getMonthlyLookupLimit,
} from './rentCastUsageTracker.js';
import { buildRentCastAddressVariants } from './rentCastAddressVariants.js';

const RENTCAST_PROPERTIES_URL = 'https://api.rentcast.io/v1/properties';
export const PROPERTY_RECORDS_UNAVAILABLE_MESSAGE = 'Property records unavailable for this address';

function getRentCastApiKey() {
  return process.env.RENTCAST_API_KEY?.trim() || '';
}

export function isRentCastConfigured() {
  return Boolean(getRentCastApiKey());
}

export function getRentCastDiagnostics() {
  return {
    configured: isRentCastConfigured(),
    monthlyLookupLimit: getMonthlyLookupLimit(),
    usage: getRentCastUsage(),
  };
}

export function normalizeRentCastAddress({
  street,
  city,
  state,
  zip,
  address,
}) {
  const streetPart = String(street || '').trim();
  const cityPart = String(city || '').trim();
  const statePart = String(state || '').trim().toUpperCase();
  const zipPart = String(zip || '').trim().replace(/\D/g, '').slice(0, 5);

  if (streetPart && cityPart && statePart && zipPart) {
    return `${streetPart}, ${cityPart}, ${statePart}, ${zipPart}`.toLowerCase();
  }

  const fallback = String(address || '').trim();
  if (!fallback) return '';

  return fallback
    .replace(/\s+/g, ' ')
    .replace(/,\s*USA$/i, '')
    .toLowerCase();
}

export function buildRentCastQueryAddress({
  street,
  city,
  state,
  zip,
  address,
}) {
  const streetPart = String(street || '').trim();
  const cityPart = String(city || '').trim();
  const statePart = String(state || '').trim().toUpperCase();
  const zipPart = String(zip || '').trim().replace(/\D/g, '').slice(0, 5);

  if (streetPart && cityPart && statePart && zipPart) {
    return `${streetPart}, ${cityPart}, ${statePart}, ${zipPart}`;
  }

  const fallback = String(address || '').trim();
  if (!fallback) {
    const err = new Error('A validated street, city, state, and zip are required for property records lookup.');
    err.code = 'INTAKE_PROPERTY_RECORDS_INVALID';
    throw err;
  }

  return fallback.replace(/,\s*USA$/i, '').trim();
}

function formatCurrency(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function sqftToAcres(sqft) {
  if (sqft == null || !Number.isFinite(Number(sqft))) return null;
  const acres = Number(sqft) / 43560;
  return `${acres.toFixed(2)} ac`;
}

function latestTaxAssessment(taxAssessments) {
  if (!taxAssessments || typeof taxAssessments !== 'object') return null;
  const years = Object.keys(taxAssessments)
    .map((year) => Number(year))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => b - a);
  if (!years.length) return null;
  const latest = taxAssessments[String(years[0])];
  return latest?.value ?? null;
}

function buildSalesNotes(property) {
  const notes = [];
  const features = property?.features || {};

  if (property?.propertyType) {
    notes.push(`${property.propertyType} structure may influence exterior pest pressure and treatment scope.`);
  }
  if (property?.yearBuilt) {
    const age = new Date().getFullYear() - Number(property.yearBuilt);
    if (age >= 30) notes.push('Older construction can mean more entry points and harborage areas.');
    else if (age <= 10) notes.push('Newer construction may have tighter envelopes but landscaping gaps still matter.');
  }
  if (property?.lotSize) {
    const acres = Number(property.lotSize) / 43560;
    if (acres >= 1) notes.push('Larger lot size suggests perimeter and lawn treatments may be relevant.');
  }
  if (features.pool) notes.push('Pool or water features can increase mosquito and moisture-related pest activity.');
  if (features.garage) notes.push('Attached garage areas are common rodent and insect entry zones.');
  if (property?.ownerOccupied === true) notes.push('Owner-occupied — decision maker likely on site during walkthrough.');
  if (property?.ownerOccupied === false) notes.push('Non-owner-occupied — confirm access and billing contact before quoting.');
  if (property?.hoa?.fee) notes.push('HOA property — verify exterior treatment restrictions with association rules.');

  return notes;
}

export function mapRentCastPropertyRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const taxAssessedValue = latestTaxAssessment(raw.taxAssessments);
  const lotAcres = sqftToAcres(raw.lotSize);

  return {
    propertyType: raw.propertyType || null,
    yearBuilt: raw.yearBuilt ?? null,
    buildingSquareFeet: raw.squareFootage ?? null,
    lotSizeSquareFeet: raw.lotSize ?? null,
    lotAcreage: lotAcres,
    bedrooms: raw.bedrooms ?? null,
    bathrooms: raw.bathrooms ?? null,
    ownerOccupied: raw.ownerOccupied ?? null,
    lastSaleDate: formatDate(raw.lastSaleDate),
    lastSalePrice: raw.lastSalePrice ?? null,
    lastSalePriceLabel: formatCurrency(raw.lastSalePrice),
    estimatedValue: null,
    estimatedValueLabel: null,
    taxAssessedValue,
    taxAssessedValueLabel: formatCurrency(taxAssessedValue),
    county: raw.county || null,
    subdivision: raw.subdivision || null,
    zoning: raw.zoning || null,
    formattedAddress: raw.formattedAddress || null,
    salesNotes: buildSalesNotes(raw),
    unavailable: false,
  };
}

async function fetchRentCastProperties(queryAddress) {
  const apiKey = getRentCastApiKey();
  if (!apiKey) {
    const err = new Error('RentCast is not configured on the server.');
    err.code = 'INTAKE_RENTCAST_KEY_MISSING';
    throw err;
  }

  const url = new URL(RENTCAST_PROPERTIES_URL);
  url.searchParams.set('address', queryAddress);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
    },
  });

  if (response.status === 404) {
    return { record: null, notFound: true, queryAddress };
  }

  if (response.status === 400) {
    let message = 'RentCast could not parse the address.';
    try {
      const body = await response.json();
      message = body?.message || message;
    } catch {
      /* ignore parse errors */
    }
    return { record: null, notFound: true, queryAddress, parseError: message };
  }

  if (!response.ok) {
    const err = new Error(`RentCast property lookup failed (${response.status}).`);
    err.code = 'INTAKE_PROPERTY_RECORDS_FAILED';
    err.httpStatus = response.status;
    throw err;
  }

  const payload = await response.json();
  const record = Array.isArray(payload) ? payload[0] : null;
  if (!record) {
    return { record: null, notFound: true, queryAddress };
  }

  return {
    record: mapRentCastPropertyRecord(record),
    notFound: false,
    queryAddress,
  };
}

async function fetchRentCastPropertiesWithFallbacks(variants) {
  const attempts = [];
  for (const queryAddress of variants) {
    const result = await fetchRentCastProperties(queryAddress);
    attempts.push({
      queryAddress,
      notFound: result.notFound,
      parseError: result.parseError || null,
    });

    if (!result.notFound && result.record && !result.record.unavailable) {
      return {
        records: result.record,
        matchedAddress: queryAddress,
        attempts,
      };
    }
  }

  return {
    records: { unavailable: true },
    matchedAddress: null,
    attempts,
  };
}

export async function lookupPropertyRecords({
  street,
  city,
  state,
  zip,
  address,
  verifiedAddress,
  confirmPaidLookup = false,
}) {
  const queryAddress = buildRentCastQueryAddress({ street, city, state, zip, address });
  const normalizedAddress = normalizeRentCastAddress({ street, city, state, zip, address: queryAddress });
  const usage = getRentCastUsage();
  const addressVariants = buildRentCastAddressVariants({
    street,
    city,
    state,
    zip,
    address: address || queryAddress,
    verifiedAddress,
  });

  if (!normalizedAddress || !addressVariants.length) {
    const err = new Error('A validated address is required for property records lookup.');
    err.code = 'INTAKE_PROPERTY_RECORDS_INVALID';
    throw err;
  }

  const cached = getCachedPropertyRecords(normalizedAddress);
  if (cached) {
    return {
      records: cached,
      cached: true,
      usage,
      normalizedAddress,
      message: cached.unavailable ? PROPERTY_RECORDS_UNAVAILABLE_MESSAGE : undefined,
    };
  }

  if (usage.hardCapReached) {
    const err = new Error('Monthly RentCast lookup limit reached. Contact an administrator to raise RENTCAST_MONTHLY_LOOKUP_LIMIT.');
    err.code = 'INTAKE_PROPERTY_RECORDS_LIMIT';
    err.usage = usage;
    throw err;
  }

  if (usage.requiresPaidConfirmation && !confirmPaidLookup) {
    return {
      records: null,
      cached: false,
      requiresConfirmation: true,
      usage,
      normalizedAddress,
      message: 'Free RentCast lookups for this month are exhausted. Confirm to run a paid lookup.',
    };
  }

  const lookup = await fetchRentCastPropertiesWithFallbacks(addressVariants);
  recordRentCastApiCall();

  const records = lookup.records?.unavailable
    ? { unavailable: true }
    : lookup.records;

  setCachedPropertyRecords(normalizedAddress, records);

  if (records.unavailable) {
    console.info('[intake] RentCast property records not found after fallback attempts:', {
      normalizedAddress,
      attempts: lookup.attempts?.length || 0,
      variants: lookup.attempts?.map((attempt) => attempt.queryAddress),
    });
  } else {
    console.info('[intake] RentCast property records matched:', {
      normalizedAddress,
      matchedAddress: lookup.matchedAddress,
    });
  }

  return {
    records,
    cached: false,
    usage: getRentCastUsage(),
    normalizedAddress,
    matchedAddress: lookup.matchedAddress || undefined,
    message: records.unavailable ? PROPERTY_RECORDS_UNAVAILABLE_MESSAGE : undefined,
  };
}
