import express from 'express';
import {
  searchAddressSuggestions,
  lookupAddress,
  getGeocodeConfigDiagnostics,
} from '../services/nominatimGeocoder.js';

const router = express.Router();

// GET /api/geocode/suggest?q=... — autocomplete suggestions
router.get('/suggest', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 4) {
    return res.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchAddressSuggestions(q, 6);
    res.json({ suggestions });
  } catch (err) {
    console.error(`[geocode] suggest failed q="${q.slice(0, 80)}":`, err.message);
    res.status(502).json({
      error: err.message,
      code: err.code || 'GEOCODE_FAILED',
    });
  }
});

// GET /api/geocode/lookup?q=... — single address → coordinates
router.get('/lookup', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Query param q is required', code: 'GEOCODE_EMPTY' });
  }

  try {
    const result = await lookupAddress(q);
    res.json({ result });
  } catch (err) {
    const status = err.code === 'GEOCODE_NOT_FOUND' || err.code === 'GEOCODE_EMPTY' ? 404 : 502;
    console.error(`[geocode] lookup failed q="${q.slice(0, 80)}":`, err.message);
    res.status(status).json({
      error: err.message,
      code: err.code || 'GEOCODE_FAILED',
    });
  }
});

// GET /api/geocode/status — provider info (no secrets)
router.get('/status', (req, res) => {
  res.json(getGeocodeConfigDiagnostics());
});

export default router;
