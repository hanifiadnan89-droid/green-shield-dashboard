import express from 'express';
import {
  refreshDate,
  getStatus,
  getNormalizedForDate,
  preloadNextThreeDays,
} from '../services/fieldRoutesPreloader.js';

const router = express.Router();

// GET /api/routes/status — cache status for next 3 dates
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
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

// POST /api/routes/preload — fire-and-forget preload for next 3 days
router.post('/preload', (req, res) => {
  res.json({ started: true });
  preloadNextThreeDays().catch(err => {
    console.error('[routes] preload failed:', err.message);
  });
});

export default router;
