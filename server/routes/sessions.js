import express from 'express';
import {
  createSession, endSession, errorSession,
  logEvent, logMessage, logAction, logState, logError, logDebug,
  getSession, getEvents, listSessions, deleteSession,
  getState, setState,
} from '../services/sessionLogger.js';

const router = express.Router();

// List sessions
router.get('/', (req, res) => {
  const { limit = 20, status } = req.query;
  res.json({ sessions: listSessions({ limit: parseInt(limit), status }) });
});

// Create session
router.post('/', (req, res) => {
  const session = createSession(req.body.meta || {});
  res.json(session);
});

// Get session
router.get('/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// End session
router.post('/:id/end', (req, res) => {
  const session = endSession(req.params.id, req.body.summary);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Error session
router.post('/:id/error', (req, res) => {
  const session = errorSession(req.params.id, req.body.error);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Delete session
router.delete('/:id', (req, res) => {
  res.json({ deleted: deleteSession(req.params.id) });
});

// Get events (filterable by type)
router.get('/:id/events', (req, res) => {
  const { types, limit = 100 } = req.query;
  const events = getEvents(req.params.id, {
    types: types ? types.split(',') : undefined,
    limit: parseInt(limit),
  });
  res.json({ events });
});

// Log any event
router.post('/:id/events', (req, res) => {
  const { type, ...data } = req.body;
  if (!type) return res.status(400).json({ error: 'type required' });
  try {
    const handlers = { message: logMessage, action: logAction, state: logState, error: logError, debug: logDebug };
    const fn = handlers[type];
    const entry = fn ? fn(req.params.id, data) : logEvent(req.params.id, type, data);
    res.json(entry);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Get state
router.get('/:id/state', (req, res) => {
  const state = getState(req.params.id);
  if (state === null) return res.status(404).json({ error: 'Session not found' });
  res.json({ state });
});

// Update state
router.patch('/:id/state', (req, res) => {
  const state = setState(req.params.id, req.body);
  if (state === null) return res.status(404).json({ error: 'Session not found' });
  res.json({ state });
});

export default router;
