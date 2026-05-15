import express from 'express';
import { appendLog } from '../services/activity.js';
import { updateLead } from '../services/sheets.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { rowNumber, leadName, template, smsText, app, number, updateSheet } = req.body;

  if (!rowNumber || !leadName) {
    return res.status(400).json({ error: 'rowNumber and leadName are required' });
  }

  try {
    if (updateSheet) {
      await updateLead(rowNumber, { sent: new Date().toISOString() });
    }

    await appendLog({
      action: 'manual_sms_sent',
      leadName,
      template: template || null,
      app: app || null,
      number: number || null,
      smsText: smsText ? smsText.slice(0, 160) : null,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to log manual SMS' });
  }
});

export default router;
