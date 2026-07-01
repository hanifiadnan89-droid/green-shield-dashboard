import express from 'express';
import { getCurrentUserContext } from '../services/currentUserContext.js';
import { updateLead, appendLead } from '../services/sheets.js';
import { transferLeadOwnership } from '../services/leadOwnership.js';
import {
  isScopedLeadAccessEnabled,
} from '../services/leadAccess.js';
import {
  getVisibleLeads,
  getLeadByRowNumber,
} from '../services/crmData/leadQueries.js';
import { appendLog } from '../services/activity.js';
import { requireManagerOrAdmin } from '../security/internalAccess.js';

const router = express.Router();

function getLeadMutationErrorStatus(err) {
  if (err?.status) return err.status;
  if (err?.code === 'VALIDATION_ERROR') return 400;
  if (err?.code === 'NOT_FOUND') return 404;
  if (err?.code === 'LEAD_ACCESS_DENIED' || err?.code === 'USER_INACTIVE') return 403;
  return 500;
}

router.get('/', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const leads = await getVisibleLeads(context);
    res.json({ leads, count: leads.length });
  } catch (err) {
    console.error('[leads] GET / failed:', err.message);
    if (err?.stack) console.error(err.stack);
    const msg = err.message || 'Failed to load leads';
    const isConfig =
      /not configured|GOOGLE_SERVICE_ACCOUNT|missing/i.test(msg)
      || /invalid JSON|parse/i.test(msg);
    res.status(isConfig ? 503 : 500).json({
      error: msg,
      code: isConfig ? 'google_credentials' : 'sheets_error',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const lead = req.body;
    const result = await appendLead(lead, context);
    appendLog({
      action: 'lead_added',
      leadName: lead.name,
      leadPhone: lead.phone,
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(getLeadMutationErrorStatus(err)).json({
      error: err.message,
      code: err.code || 'LEAD_UPDATE_FAILED',
    });
  }
});

router.post('/:rowNumber/transfer', requireManagerOrAdmin, async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const ownerUserId = String(req.body?.ownerUserId || '').trim();
    if (!rowNumber) {
      return res.status(400).json({ error: 'Invalid row number', code: 'VALIDATION_ERROR' });
    }
    if (!ownerUserId) {
      return res.status(400).json({ error: 'ownerUserId is required', code: 'VALIDATION_ERROR' });
    }

    const ownership = transferLeadOwnership(rowNumber, ownerUserId, context);
    appendLog({
      action: 'lead_transferred',
      rowNumber,
      ownerUserId,
      transferredBy: context.userId,
      status: 'success',
    });
    return res.json({ ownership });
  } catch (err) {
    const status = err.code === 'VALIDATION_ERROR' ? 400 : err.code === 'NOT_FOUND' ? 404 : 500;
    return res.status(status).json({
      error: err.message || 'Failed to transfer lead ownership',
      code: err.code || 'TRANSFER_LEAD_FAILED',
    });
  }
});

router.put('/:rowNumber', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const updates = req.body;
    if (isScopedLeadAccessEnabled()) {
      const lead = await getLeadByRowNumber(context, rowNumber);
      if (!lead) {
        return res.status(403).json({ error: 'Lead edit access denied.', code: 'LEAD_ACCESS_DENIED' });
      }
    }
    const result = await updateLead(rowNumber, updates, context);
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
    res.status(getLeadMutationErrorStatus(err)).json({
      error: err.message,
      code: err.code || 'LEAD_STOP_FAILED',
    });
  }
});

router.post('/:rowNumber/stop', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const { name } = req.body;
    if (isScopedLeadAccessEnabled()) {
      const lead = await getLeadByRowNumber(context, rowNumber);
      if (!lead) {
        return res.status(403).json({ error: 'Lead edit access denied.', code: 'LEAD_ACCESS_DENIED' });
      }
    }
    const result = await updateLead(rowNumber, { stop: 'yes', status: 'stopped' }, context);
    appendLog({
      action: 'lead_stopped',
      leadName: name,
      rowNumber,
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(getLeadMutationErrorStatus(err)).json({
      error: err.message,
      code: err.code || 'LEAD_DELETE_FAILED',
    });
  }
});

router.delete('/:rowNumber', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const { name } = req.body || {};
    if (isScopedLeadAccessEnabled()) {
      const lead = await getLeadByRowNumber(context, rowNumber);
      if (!lead) {
        return res.status(403).json({ error: 'Lead edit access denied.', code: 'LEAD_ACCESS_DENIED' });
      }
    }
    const result = await updateLead(rowNumber, { deleted: 'yes' }, context);
    appendLog({
      action: 'lead_deleted',
      leadName: name,
      rowNumber,
      testMode: result.testMode || false,
      status: 'success'
    });
    res.json(result);
  } catch (err) {
    res.status(getLeadMutationErrorStatus(err)).json({
      error: err.message,
      code: err.code || 'LEAD_UNSTOP_FAILED',
    });
  }
});

router.post('/:rowNumber/unstop', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }
    const rowNumber = parseInt(req.params.rowNumber, 10);
    const { name } = req.body;
    if (isScopedLeadAccessEnabled()) {
      const lead = await getLeadByRowNumber(context, rowNumber);
      if (!lead) {
        return res.status(403).json({ error: 'Lead edit access denied.', code: 'LEAD_ACCESS_DENIED' });
      }
    }
    const result = await updateLead(rowNumber, { stop: '', status: 'active' }, context);
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
