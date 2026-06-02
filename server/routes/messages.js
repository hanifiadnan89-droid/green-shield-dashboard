import express from 'express';
import {
  syncLeadsMessages,
  getMessagesForLead,
  appendMessage,
  mergeLocalOutboundHistory,
  getConversationPreview,
} from '../services/conversationMessages.js';

const router = express.Router();

/** Sync sheet reply fields → append-only history for many leads */
router.post('/sync', (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads array is required' });
    }
    const threads = syncLeadsMessages(leads);
    const meta = {};
    for (const [rowNumber, messages] of Object.entries(threads)) {
      meta[rowNumber] = getConversationPreview(messages);
    }
    res.json({ threads, meta });
  } catch (err) {
    console.error('[messages] sync error:', err);
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

router.get('/:rowNumber', (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber, 10);
    if (!rowNumber) return res.status(400).json({ error: 'Invalid row number' });
    const messages = getMessagesForLead(rowNumber);
    res.json({ messages, meta: getConversationPreview(messages) });
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
