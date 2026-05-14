import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = path.join(__dirname, '..', 'data', 'sessions');
const MAX_EVENTS = 1000;  // per session file
const MAX_FILES  = 100;   // total session files kept on disk

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sessionPath(sessionId) {
  return path.join(DATA_DIR, `${sessionId}.json`);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readSession(sessionId) {
  ensureDir();
  const file = sessionPath(sessionId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeSession(session) {
  ensureDir();
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf8');
}

function pruneOldSessions() {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(DATA_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  files.slice(MAX_FILES).forEach(f => {
    try { fs.unlinkSync(path.join(DATA_DIR, f.name)); } catch {}
  });
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

/**
 * Create a new session. Returns the full session object.
 * @param {object} meta  Arbitrary metadata (botName, userId, channel, etc.)
 */
export function createSession(meta = {}) {
  pruneOldSessions();
  const session = {
    id:        uid(),
    startedAt: new Date().toISOString(),
    endedAt:   null,
    status:    'active',   // active | ended | error
    meta,
    state:     {},         // mutable key-value state (persisted between events)
    events:    [],         // all log entries in order
  };
  writeSession(session);
  return session;
}

/**
 * End a session cleanly.
 */
export function endSession(sessionId, summary = '') {
  const session = readSession(sessionId);
  if (!session) return null;
  session.endedAt = new Date().toISOString();
  session.status  = 'ended';
  if (summary) session.summary = summary;
  writeSession(session);
  return session;
}

/**
 * Mark a session as errored.
 */
export function errorSession(sessionId, error) {
  const session = readSession(sessionId);
  if (!session) return null;
  session.endedAt = new Date().toISOString();
  session.status  = 'error';
  session.error   = error instanceof Error ? error.message : String(error);
  writeSession(session);
  return session;
}

// ── Event logging ─────────────────────────────────────────────────────────────

/**
 * Append an event to a session.
 * type: 'message' | 'action' | 'state' | 'error' | 'debug' | string
 */
export function logEvent(sessionId, type, data = {}) {
  const session = readSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const entry = {
    id:        uid(),
    timestamp: new Date().toISOString(),
    type,
    ...data,
  };

  session.events.push(entry);
  if (session.events.length > MAX_EVENTS) {
    session.events = session.events.slice(-MAX_EVENTS);
  }

  writeSession(session);
  return entry;
}

// ── Typed convenience loggers ─────────────────────────────────────────────────

/** Log a user or bot message */
export function logMessage(sessionId, { role, content, channel }) {
  return logEvent(sessionId, 'message', { role, content, channel });
}

/** Log a bot action (API call, webhook, send, etc.) */
export function logAction(sessionId, { action, input, output, success = true }) {
  return logEvent(sessionId, 'action', { action, input, output, success });
}

/** Log a state change and persist the new state */
export function logState(sessionId, updates = {}) {
  const session = readSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);
  Object.assign(session.state, updates);
  const entry = {
    id:        uid(),
    timestamp: new Date().toISOString(),
    type:      'state',
    updates,
    snapshot:  { ...session.state },
  };
  session.events.push(entry);
  writeSession(session);
  return entry;
}

/** Log an error without ending the session */
export function logError(sessionId, error, context = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack   = error instanceof Error ? error.stack   : undefined;
  return logEvent(sessionId, 'error', { message, stack, ...context });
}

/** Log a debug event (shown in dev, filterable in prod) */
export function logDebug(sessionId, message, data = {}) {
  return logEvent(sessionId, 'debug', { message, ...data });
}

// ── State access ──────────────────────────────────────────────────────────────

/** Read the current state snapshot for a session */
export function getState(sessionId) {
  return readSession(sessionId)?.state ?? null;
}

/** Overwrite a state key directly without logging an event */
export function setState(sessionId, updates = {}) {
  const session = readSession(sessionId);
  if (!session) return null;
  Object.assign(session.state, updates);
  writeSession(session);
  return session.state;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/** Get full session object */
export function getSession(sessionId) {
  return readSession(sessionId);
}

/** Get events filtered by type(s), most recent first */
export function getEvents(sessionId, { types, limit = 100 } = {}) {
  const session = readSession(sessionId);
  if (!session) return [];
  let events = [...session.events].reverse();
  if (types) events = events.filter(e => types.includes(e.type));
  return events.slice(0, limit);
}

/** List recent sessions (most recent first) */
export function listSessions({ limit = 20, status } = {}) {
  ensureDir();
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const s = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
        return { id: s.id, status: s.status, startedAt: s.startedAt, endedAt: s.endedAt, meta: s.meta };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

  return (status ? files.filter(s => s.status === status) : files).slice(0, limit);
}

/** Delete a session file */
export function deleteSession(sessionId) {
  const file = sessionPath(sessionId);
  if (fs.existsSync(file)) { fs.unlinkSync(file); return true; }
  return false;
}
