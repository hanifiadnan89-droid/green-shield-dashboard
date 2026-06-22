import express from 'express';
import { isIntakeEnabled } from '../services/intakeFeatureFlag.js';
import {
  validateAndNormalizeAddress,
  geocodeAddress,
  lookupWeatherForDate,
  getIntakeApiDiagnostics,
} from '../services/googleIntakeApis.js';
import {
  lookupPropertyRecords,
  getRentCastDiagnostics,
} from '../services/rentCastPropertyRecords.js';

const router = express.Router();

function intakeDisabled(_req, res) {
  res.status(404).json({ error: 'Intake is not enabled', code: 'INTAKE_DISABLED' });
}

router.use((req, res, next) => {
  if (!isIntakeEnabled()) return intakeDisabled(req, res);
  next();
});

router.get('/status', (_req, res) => {
  res.json({
    enabled: isIntakeEnabled(),
    google: getIntakeApiDiagnostics(),
    rentCast: getRentCastDiagnostics(),
  });
});

router.get('/property-records/usage', (_req, res) => {
  res.json({ usage: getRentCastDiagnostics().usage });
});

router.post('/property-records', async (req, res) => {
  try {
    const {
      street,
      city,
      state,
      zip,
      address,
      verifiedAddress,
      confirmPaidLookup = false,
    } = req.body || {};

    const result = await lookupPropertyRecords({
      street,
      city,
      state,
      zip,
      address,
      verifiedAddress,
      confirmPaidLookup: Boolean(confirmPaidLookup),
    });

    res.json(result);
  } catch (err) {
    const status = err.code === 'INTAKE_PROPERTY_RECORDS_INVALID' ? 400
      : err.code === 'INTAKE_RENTCAST_KEY_MISSING' ? 503
        : err.code === 'INTAKE_PROPERTY_RECORDS_LIMIT' ? 429
          : 502;
    console.error('[intake] property-records failed:', err.message);
    res.status(status).json({
      error: err.message,
      code: err.code || 'INTAKE_PROPERTY_RECORDS_FAILED',
      usage: err.usage || undefined,
    });
  }
});

router.post('/validate-address', async (req, res) => {
  try {
    const {
      addressLines,
      street,
      city,
      state,
      zip,
      regionCode = 'US',
    } = req.body || {};

    const lines = addressLines?.length
      ? addressLines
      : [street, [city, state, zip].filter(Boolean).join(' ')].filter(Boolean);

    const result = await validateAndNormalizeAddress({
      addressLines: lines,
      regionCode,
      locality: city,
      administrativeArea: state,
      postalCode: zip,
    });

    if ((result.latitude == null || result.longitude == null) && result.formattedAddress) {
      try {
        const geocoded = await geocodeAddress(result.formattedAddress);
        result.latitude = result.latitude ?? geocoded.latitude;
        result.longitude = result.longitude ?? geocoded.longitude;
        result.placeId = result.placeId || geocoded.placeId;
        result.placeTypes = result.placeTypes?.length ? result.placeTypes : geocoded.placeTypes;
      } catch {
        /* validation may already include geocode */
      }
    }

    res.json({ result });
  } catch (err) {
    const status = err.code === 'INTAKE_ADDRESS_EMPTY' ? 400 : 502;
    console.error('[intake] validate-address failed:', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'INTAKE_VALIDATE_FAILED' });
  }
});

router.post('/geocode', async (req, res) => {
  try {
    const { query, address } = req.body || {};
    const q = query || address;
    const result = await geocodeAddress(q);
    res.json({ result });
  } catch (err) {
    const status = err.code === 'INTAKE_GEOCODE_EMPTY' ? 400
      : err.code === 'INTAKE_GEOCODE_NOT_FOUND' ? 404
        : 502;
    console.error('[intake] geocode failed:', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'INTAKE_GEOCODE_FAILED' });
  }
});

router.get('/weather', async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const latitude = Number(req.query.lat ?? req.query.latitude);
    const longitude = Number(req.query.lng ?? req.query.longitude);

    const weather = await lookupWeatherForDate({ date, latitude, longitude });
    res.json({ weather });
  } catch (err) {
    const status = err.code === 'INTAKE_WEATHER_INVALID' ? 400 : 502;
    console.error('[intake] weather failed:', err.message);
    res.status(status).json({ error: err.message, code: err.code || 'INTAKE_WEATHER_FAILED' });
  }
});

export default router;
