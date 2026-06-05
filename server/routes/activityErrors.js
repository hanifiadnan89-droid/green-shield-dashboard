import express from 'express';
import { completeActivityError, getActivityErrors } from '../services/activityErrors.js';

const router = express.Router();

function sheetsErrorResponse(res, err) {
  console.error('[activity-errors]', err.message);
  if (err?.stack) console.error(err.stack);
  const msg = err.message || 'Failed to process activity errors';
  const isConfig =
    /not configured|GOOGLE_SERVICE_ACCOUNT|missing/i.test(msg)
    || /invalid JSON|parse/i.test(msg);
  res.status(isConfig ? 503 : 500).json({
    error: msg,
    code: isConfig ? 'google_credentials' : 'sheets_error',
  });
}

router.get('/', async (req, res) => {
  try {
    const data = await getActivityErrors();
    res.json(data);
  } catch (err) {
    sheetsErrorResponse(res, err);
  }
});

router.post('/:rowNumber/complete', async (req, res) => {
  try {
    const result = await completeActivityError(req.params.rowNumber);
    res.json(result);
  } catch (err) {
    if (/invalid row/i.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    sheetsErrorResponse(res, err);
  }
});

export default router;
