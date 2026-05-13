import express from 'express';
import { getLeads, updateLead, appendLead } from '../services/sheets.js';
import { appendLog } from '../services/activity.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const leads = await getLeads();
    res.json({ leads, count: leads.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const lead = req.body;
    const result = await appendLead(lead);
    appendLog({
      action: 'lead_added',
      leadName: lead.name,
      leadPhone: lead.phone,
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:rowNumber', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const updates = req.body;
    const result = await updateLead(rowNumber, updates);
    appendLog({
      action: 'lead_updated',
      leadName: updates.name,
      rowNumber,
      fields: Object.keys(updates).join(', '),
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:rowNumber/stop', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const { name } = req.body;
    const result = await updateLead(rowNumber, { stop: 'yes', status: 'stopped' });
    appendLog({
      action: 'lead_stopped',
      leadName: name,
      rowNumber,
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:rowNumber/unstop', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const { name } = req.body;
    const result = await updateLead(rowNumber, { stop: '', status: 'active' });
    appendLog({
      action: 'lead_unstopped',
      leadName: name,
      rowNumber,
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
