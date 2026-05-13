import express from 'express';
import { triggerLeadWebhook } from '../services/n8n.js';
import { updateLead } from '../services/sheets.js';
import { appendLog } from '../services/activity.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { lead, template, channel } = req.body;

  if (!lead || !template) {
    return res.status(400).json({ error: 'lead and template are required' });
  }

  if (lead.stop === 'yes') {
    return res.status(400).json({ error: 'This lead has stop=yes. Remove the stop flag before sending.' });
  }

  const payload = {
    row_number: lead.row_number,
    sheet_name: process.env.SHEET_NAME || 'Lead Responses',
    name: lead.name || '',
    email: lead.email || '',
    notes: template,
    status: lead.status || '',
    sent: lead.sent || '',
    error: lead.error || '',
    stop: lead.stop || '',
    phone: lead.phone || '',
    channel: channel || 'both'
  };

  let n8nResult;
  let logStatus = 'success';
  let logError = null;

  try {
    n8nResult = await triggerLeadWebhook(payload);
  } catch (err) {
    logStatus = 'error';
    logError = err.message;
    appendLog({
      action: 'template_sent',
      leadName: lead.name,
      leadPhone: lead.phone,
      template,
      channel: channel || 'both',
      testMode: false,
      status: 'error',
      error: err.message
    });
    return res.status(500).json({ error: err.message });
  }

  if (!n8nResult.testMode) {
    try {
      await updateLead(lead.row_number, { sent: new Date().toISOString(), error: '' });
    } catch {
      // Non-fatal: log but don't fail the send
    }
  }

  appendLog({
    action: 'template_sent',
    leadName: lead.name,
    leadPhone: lead.phone,
    leadEmail: lead.email,
    template,
    channel: channel || 'both',
    testMode: n8nResult.testMode || false,
    status: logStatus,
    error: logError,
    n8nResult
  });

  res.json({
    success: true,
    testMode: n8nResult.testMode || false,
    message: n8nResult.testMode
      ? `[TEST MODE] Would have sent ${template.toUpperCase()} template to ${lead.name}`
      : `Sent ${template.toUpperCase()} template to ${lead.name} — n8n follow-up sequence started`,
    details: n8nResult
  });
});

export default router;
