import express from 'express';
import { getCurrentUserContext } from '../services/currentUserContext.js';
import { isScopedLeadAccessEnabled } from '../services/leadAccess.js';
import {
  getReplyThread,
  getVisibleReplyThreads,
} from '../services/crmData/replies/replyQueries.js';

const router = express.Router();

function parseRowNumber(value) {
  const rowNumber = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(rowNumber) ? rowNumber : null;
}

router.get('/', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (!context) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }

    const payload = await getVisibleReplyThreads(context);
    const selectedRow = parseRowNumber(req.query?.rowNumber);
    if (selectedRow) {
      const selectedConversation = await getReplyThread(context, selectedRow);
      return res.json({
        ...payload,
        selectedConversation,
      });
    }
    res.json({
      ...payload,
    });
  } catch (err) {
    console.error('[replies] GET / failed:', err.message);
    const status = err?.status || 500;
    const code = err?.code || 'REPLIES_LOAD_FAILED';
    res.status(status).json({ error: err.message || 'Failed to load replies', code });
  }
});

router.get('/:rowNumber', async (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    if (!context) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    if (isScopedLeadAccessEnabled() && context?.status !== 'active') {
      return res.status(403).json({ error: 'This user account is inactive.', code: 'USER_INACTIVE' });
    }

    const rowNumber = parseRowNumber(req.params.rowNumber);
    if (!rowNumber) {
      return res.status(400).json({ error: 'Invalid row number', code: 'VALIDATION_ERROR' });
    }

    const thread = await getReplyThread(context, rowNumber);
    res.json({
      ...thread,
    });
  } catch (err) {
    console.error('[replies] GET /:rowNumber failed:', err.message);
    const status = err?.status || (err?.code === 'NOT_FOUND' ? 404 : 500);
    res.status(status).json({
      error: err.message || 'Failed to load reply thread',
      code: err.code || 'REPLY_THREAD_FAILED',
    });
  }
});

export default router;
