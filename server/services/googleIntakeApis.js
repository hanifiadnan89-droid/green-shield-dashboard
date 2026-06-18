import { getCachedWeather, setCachedWeather } from './intakeWeatherCache.js';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const ADDRESS_VALIDATION_URL = 'https://addressvalidation.googleapis.com/v1:validateAddress';
const WEATHER_FORECAST_URL = 'https://weather.googleapis.com/v1/forecast/days:lookup';

function getMapsServerApiKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY
    || process.env.GOOGLE_ROUTES_API_KEY
    || ''
  ).trim();
}

export function getIntakeApiDiagnostics() {
  const key = getMapsServerApiKey();
  return {
    configured: Boolean(key),
    addressValidation: Boolean(key),
    geocoding: Boolean(key),
    weather: Boolean(key),
  };
}

function assertApiKey() {
  const key = getMapsServerApiKey();
  if (!key) {
    const err = new Error('Google Maps server API key is not configured');
    err.code = 'INTAKE_GOOGLE_KEY_MISSING';
    throw err;
  }
  return key;
}

function parseAddressComponents(components = []) {
  const out = {
    streetNumber: '',
    route: '',
    subpremise: '',
    locality: '',
    adminArea: '',
    postalCode: '',
    country: '',
  };

  for (const component of components) {
    const types = component.types || [];
    const value = component.longText || component.shortText || component.long_name || component.short_name || '';
    if (types.includes('street_number')) out.streetNumber = value;
    if (types.includes('route')) out.route = value;
    if (types.includes('subpremise')) out.subpremise = value;
    if (types.includes('locality')) out.locality = value;
    if (types.includes('administrative_area_level_1')) out.adminArea = component.shortText || component.short_name || value;
    if (types.includes('postal_code')) out.postalCode = value;
    if (types.includes('country')) out.country = component.shortText || component.short_name || value;
  }

  const street = [out.streetNumber, out.route].filter(Boolean).join(' ').trim();
  return {
    street,
    city: out.locality,
    state: out.adminArea,
    zip: out.postalCode,
    country: out.country,
    subpremise: out.subpremise,
  };
}

function parseLegacyGeocodeComponents(components = []) {
  const mapped = components.map((c) => ({
    types: c.types,
    longText: c.long_name,
    shortText: c.short_name,
  }));
  return parseAddressComponents(mapped);
}

function verdictConfidence(verdict = {}) {
  if (verdict.addressComplete && verdict.hasUnconfirmedComponents !== true) return 'high';
  if (verdict.addressComplete) return 'medium';
  if (verdict.hasInferredComponents) return 'medium';
  return 'low';
}

export async function validateAndNormalizeAddress({
  addressLines = [],
  regionCode = 'US',
  locality,
  administrativeArea,
  postalCode,
}) {
  const apiKey = assertApiKey();
  const lines = addressLines.map((l) => String(l || '').trim()).filter(Boolean);
  if (!lines.length) {
    const err = new Error('Address is required');
    err.code = 'INTAKE_ADDRESS_EMPTY';
    throw err;
  }

  const body = {
    address: {
      regionCode,
      addressLines: lines,
      ...(locality ? { locality } : {}),
      ...(administrativeArea ? { administrativeArea } : {}),
      ...(postalCode ? { postalCode } : {}),
    },
  };

  const res = await fetch(`${ADDRESS_VALIDATION_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Address validation failed (${res.status})`);
    err.code = 'INTAKE_ADDRESS_VALIDATION_FAILED';
    throw err;
  }

  const result = data.result || {};
  const postal = result.address?.postalAddress || {};
  const components = result.address?.addressComponents || [];
  const parsed = parseAddressComponents(components);
  const geocode = result.geocode || {};
  const location = geocode.location || {};

  const formattedAddress = result.address?.formattedAddress
    || postal.formattedAddress
    || lines.join(', ');

  const addressLinesOut = postal.addressLines?.length
    ? postal.addressLines
    : [parsed.street || lines[0]].filter(Boolean);

  return {
    formattedAddress,
    verifiedAddress: formattedAddress,
    addressLines: addressLinesOut,
    street: addressLinesOut[0] || parsed.street,
    city: postal.locality || parsed.city,
    state: postal.administrativeArea || parsed.state,
    zip: postal.postalCode || parsed.zip,
    country: postal.regionCode || parsed.country || regionCode,
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    placeId: geocode.placeId || null,
    placeTypes: geocode.featureSizeMeters != null ? [] : (geocode.types || []),
    verdict: result.verdict || {},
    propertyConfidence: verdictConfidence(result.verdict || {}),
    uspsData: result.uspsData || null,
    validationGranularity: result.verdict?.validationGranularity || null,
  };
}

export async function geocodeAddress(query) {
  const apiKey = assertApiKey();
  const q = String(query || '').trim();
  if (!q) {
    const err = new Error('Address query is required');
    err.code = 'INTAKE_GEOCODE_EMPTY';
    throw err;
  }

  const url = new URL(GEOCODE_URL);
  url.searchParams.set('address', q);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.status === 'REQUEST_DENIED') {
    const err = new Error(data.error_message || `Geocoding failed (${data.status || res.status})`);
    err.code = 'INTAKE_GEOCODE_FAILED';
    throw err;
  }

  if (data.status !== 'OK' || !data.results?.length) {
    const err = new Error('No geocode results for this address');
    err.code = 'INTAKE_GEOCODE_NOT_FOUND';
    throw err;
  }

  const top = data.results[0];
  const parsed = parseLegacyGeocodeComponents(top.address_components || []);
  const loc = top.geometry?.location || {};

  return {
    formattedAddress: top.formatted_address,
    verifiedAddress: top.formatted_address,
    street: parsed.street,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    latitude: loc.lat ?? null,
    longitude: loc.lng ?? null,
    placeId: top.place_id || null,
    placeTypes: top.types || [],
    locationType: top.geometry?.location_type || null,
  };
}

function findForecastDay(forecastDays, targetDate) {
  if (!Array.isArray(forecastDays) || !targetDate) return null;
  return forecastDays.find((day) => {
    const d = day.displayDate;
    if (!d) return false;
    const iso = `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
    return iso === targetDate;
  }) || null;
}

function pickDaytimeForecast(day) {
  return day?.daytimeForecast || day?.nighttimeForecast || day?.maxTemperature || day;
}

export async function lookupWeatherForDate({ date, latitude, longitude }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!date || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    const err = new Error('date, latitude, and longitude are required');
    err.code = 'INTAKE_WEATHER_INVALID';
    throw err;
  }

  const cached = getCachedWeather(date, lat, lng);
  if (cached) return { ...cached, cached: true };

  const apiKey = assertApiKey();
  const url = new URL(WEATHER_FORECAST_URL);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('days', '10');

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error?.message || `Weather lookup failed (${res.status})`);
    err.code = 'INTAKE_WEATHER_FAILED';
    throw err;
  }

  const day = findForecastDay(data.forecastDays, date);
  const daytime = pickDaytimeForecast(day);
  const precip = daytime?.precipitation || day?.precipitation || {};
  const rainProbability = precip.probability?.percent ?? precip.probability ?? null;
  const qpf = precip.qpf?.quantity ?? precip.qpf ?? null;
  const wind = daytime?.wind || day?.wind || {};
  const windSpeed = wind.speed?.value ?? wind.speed ?? null;
  const windGust = wind.gust?.value ?? wind.gust ?? null;
  const temperature = daytime?.temperature?.degrees ?? daytime?.maxTemperature?.degrees ?? null;
  const weatherType = daytime?.weatherCondition?.type
    || day?.weatherCondition?.type
    || '';

  const payload = {
    date,
    latitude: lat,
    longitude: lng,
    rainProbabilityPercent: rainProbability,
    measurableRainExpected: typeof qpf === 'number' ? qpf > 0 : null,
    precipitationQuantity: qpf,
    windSpeedMph: windSpeed,
    windGustMph: windGust,
    temperatureF: temperature,
    weatherType,
    displayDate: day?.displayDate || null,
    cached: false,
  };

  setCachedWeather(date, lat, lng, payload);
  return payload;
}
