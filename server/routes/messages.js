import express from 'express';
import {
  syncLeadsMessages,
  getMessagesForLead,
  appendMessage,
  mergeLocalOutboundHistory,
  getConversationPreview,
  markThreadRead,
  getLatestInboundReadKey,
  countUnreadForLeads,
  getThreadMeta,
} from '../services/conversationMessages.js';

const router = express.Router();

/** Sync sheet reply fields → append-only history for many leads */
router.post('/sync', (req, res) => {
  try {
    const { leads, legacyViewedKeys } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads array is required' });
    }
    const { threads, meta } = syncLeadsMessages(leads, {
      legacyViewedKeys: Array.isArray(legacyViewedKeys) ? legacyViewedKeys : [],
    });
    res.json({ threads, meta });
  } catch (err) {
    console.error('[messages] sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/unread-count', (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads array is required' });
    }
    syncLeadsMessages(leads);
    res.json(countUnreadForLeads(leads));
  } catch (err) {
    console.error('[messages] unread-count error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** One-time merge of browser localStorage outbound history */
router.post('/migrate-local', (req, res) => {
  try {
    const { history } = req.body;
    const result = mergeLocalOutboundHistory(history || {});
    res.json(result);
  } catch (err) {
    console.error('[messages] migrate-local error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:rowNumber/read', (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    if (!rowNumber) return res.status(400).json({ error: 'Invalid row number' });
    let inboundKey = req.body?.inboundKey;
    if (!inboundKey) {
      const messages = getMessagesForLead(rowNumber);
      inboundKey = getLatestInboundReadKey(messages);
    }
    if (!inboundKey) {
      return res.json({ lastReadInboundKey: null, lastReadAt: null, unread: false });
    }
    const readState = await markThreadRead(rowNumber, { inboundKey });
    const messages = getMessagesForLead(rowNumber);
    res.json({
      ...readState,
      meta: {
        ...getConversationPreview(messages),
        ...readState,
      },
    });
  } catch (err) {
    console.error('[messages] read error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:rowNumber', (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    if (!rowNumber) return res.status(400).json({ error: 'Invalid row number' });
    const messages = getMessagesForLead(rowNumber);
    res.json({ messages, meta: getThreadMeta(rowNumber) });
  } catch (err) {
    console.error('[messages] get error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:rowNumber', (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    if (!rowNumber) return res.status(400).json({ error: 'Invalid row number' });
    const message = appendMessage(rowNumber, req.body);
    const messages = getMessagesForLead(rowNumber);
    res.json({ message, messages, meta: getConversationPreview(messages) });
  } catch (err) {
    console.error('[messages] append error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
