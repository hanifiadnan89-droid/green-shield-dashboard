import express from 'express';
import {
  refreshDate,
  getStatus,
  getNormalizedForDate,
  preloadNextSixWorkingDays,
} from '../services/fieldRoutesPreloader.js';
import { getAuthStatus, checkAuthHealth } from '../services/fieldRoutesAuth.js';

const router = express.Router();

// GET /api/routes/status — cache status for next 6 working days + auth status
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/auth-status — current FieldRoutes auth status (explicit endpoint)
router.get('/auth-status', (req, res) => {
  const auth = getAuthStatus();
  res.json(auth);
});

// POST /api/routes/auth-check — trigger an immediate auth health check
router.post('/auth-check', async (req, res) => {
  try {
    const result = await checkAuthHealth();
    res.json({ result, ...getAuthStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/routes/payload?date=YYYY-MM-DD — normalized technician data for a date
router.get('/payload', async (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }
  const data = await getNormalizedForDate(date);
  if (!data) {
    return res.status(404).json({ error: 'No cached data for this date', date });
  }
  res.json(data);
});

// POST /api/routes/refresh?date=YYYY-MM-DD — trigger single-date fetch (fire-and-forget)
router.post('/refresh', (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date query param required (YYYY-MM-DD)' });
  }
  res.json({ started: true, date });
  refreshDate(date).catch(err => {
    console.error(`[routes] refresh ${date} failed:`, err.message);
  });
});

// POST /api/routes/preload — fire-and-forget preload for next 6 working days
// ?force=true bypasses the 6-hour freshness check and re-scrapes every date
router.post('/preload', (req, res) => {
  const force = req.query.force === 'true';
  res.json({ started: true, force });
  preloadNextSixWorkingDays({ force }).catch(err => {
    console.error('[routes] preload failed:', err.message);
  });
});

export default router;
