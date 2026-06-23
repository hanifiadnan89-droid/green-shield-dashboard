import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_FILE = path.join(__dirname, '..', 'data', 'conversation-messages.json');

const TMPL_LABEL = {
  na: 'No-Answer follow-up sent',
  ag: 'Agreement follow-up sent',
  ch: 'Check-in sent',
};

function ensureFile() {
  const dir = path.dirname(STORE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ threads: {} }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureFile();
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (raw && typeof raw === 'object' && raw.threads) return raw;
    return { threads: {} };
  } catch (err) {
    console.error('[conversationMessages] Failed to read store:', err.message);
    return { threads: {} };
  }
}

function writeStore(store) {
  ensureFile();
  const tmp = `${STORE_FILE}.tmp`;
  const payload = JSON.stringify(store, null, 2);
  fs.writeFileSync(tmp, payload, 'utf8');
  fs.renameSync(tmp, STORE_FILE);
}

function ensureReadInboundKeys(thread) {
  if (!Array.isArray(thread.readInboundKeys)) {
    thread.readInboundKeys = [];
  }
  return thread.readInboundKeys;
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRealReplyText(text) {
  const t = (text || '').trim();
  return t.length > 0 && t !== '.' && t !== 'yes';
}

function isFlagOnly(text) {
  const t = (text || '').trim();
  return t === 'yes';
}

function normalizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const direction = msg.direction === 'inbound' ? 'inbound' : 'outbound';
  const channel = msg.channel === 'email' ? 'email' : 'sms';
  const body = typeof msg.body === 'string' ? msg.body.trim() : '';
  if (!body) return null;
  const ts = msg.ts || msg.timestamp || new Date().toISOString();
  return {
    id: msg.id || newId('msg'),
    direction,
    channel,
    body,
    ts,
    receivedAt: msg.receivedAt || null,
    sender: msg.sender || null,
    status: msg.status || null,
    meta: msg.meta && typeof msg.meta === 'object' ? msg.meta : undefined,
  };
}

function messageKey(m) {
  return `${m.direction}|${m.channel}|${m.body}|${m.ts}`;
}

function hasMessage(messages, candidate) {
  const key = messageKey(candidate);
  return messages.some(m => messageKey(m) === key);
}

function findInboundByContent(messages, channel, body) {
  const normalizedBody = (body || '').trim();
  if (!normalizedBody) return null;
  const ch = channel === 'email' ? 'email' : 'sms';
  return messages.find(
    m => m.direction === 'inbound' && m.channel === ch && (m.body || '').trim() === normalizedBody,
  ) || null;
}

/** Same row + channel + body → same ts across resync/redeploy (read cursor stays valid). */
export function stableInboundTs(rowNumber, channel, body) {
  const seed = `${rowNumber}|${channel === 'email' ? 'email' : 'sms'}|${(body || '').trim()}`;
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const anchor = Date.UTC(2024, 0, 1);
  const offsetMs = Math.abs(h) % (5 * 365 * 24 * 60 * 60 * 1000);
  return new Date(anchor + offsetMs).toISOString();
}

function parseTimeMs(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

async function persistReadAtToSheet(rowNumber, iso) {
  console.log(`[READ-DIAG] persistReadAtToSheet entry: rowNumber=${rowNumber} iso=${iso}`);
  if (process.env.TEST_MODE === 'true' || !iso) {
    console.log(`[READ-DIAG] persistReadAtToSheet skipped: TEST_MODE=${process.env.TEST_MODE} iso=${iso}`);
    return;
  }
  try {
    console.log(`[READ-DIAG] persistReadAtToSheet calling updateLead: rowNumber=${rowNumber}`);
    const { updateLead } = await import('./sheets.js');
    await updateLead(rowNumber, { replies_last_read_at: iso });
    console.log(`[READ-DIAG] persistReadAtToSheet updateLead success: rowNumber=${rowNumber}`);
  } catch (err) {
    console.warn(`[READ-DIAG] persistReadAtToSheet updateLead FAILED: rowNumber=${rowNumber} err=${err.message}`);
    console.warn('[conversationMessages] Sheet read-state persist failed:', err.message);
  }
}

function hydrateThreadReadFromLead(thread, lead) {
  const sheetAt = lead?.replies_last_read_at;
  if (!sheetAt) return;
  const sheetMs = parseTimeMs(sheetAt);
  if (sheetMs == null) return;
  const threadMs = parseTimeMs(thread.lastReadAt);
  if (threadMs == null || sheetMs > threadMs) {
    thread.lastReadAt = sheetAt;
  }
}

function sortMessages(messages) {
  return [...messages].sort((a, b) => {
    const ta = new Date(a.receivedAt || a.ts).getTime();
    const tb = new Date(b.receivedAt || b.ts).getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}

function getThread(store, rowNumber) {
  const key = String(rowNumber);
  if (!store.threads[key]) {
    store.threads[key] = {
      messages: [],
      lastSyncedSmsReply: '',
      lastSyncedEmailReply: '',
      lastReadInboundKey: null,
      lastReadAt: null,
    };
  }
  const thread = store.threads[key];
  if (thread.lastReadInboundKey === undefined) {
    thread.lastReadInboundKey = null;
  }
  if (thread.lastReadAt === undefined) {
    thread.lastReadAt = null;
  }
  ensureReadInboundKeys(thread);
  return thread;
}

/** Stable read cursor — survives message id regeneration after redeploy */
export function inboundReadKey(message) {
  if (!message || message.direction !== 'inbound') return null;
  const body = (message.body || '').trim();
  if (!body) return null;
  const ts = message.ts || '';
  const channel = message.channel === 'email' ? 'email' : 'sms';
  return `${channel}|${ts}|${body}`;
}

export function getLatestInbound(messages) {
  if (!messages?.length) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === 'inbound') return messages[i];
  }
  return null;
}

export function getLatestInboundReadKey(messages) {
  return inboundReadKey(getLatestInbound(messages));
}

export function getLastInboundAt(messages) {
  const inbound = getLatestInbound(messages);
  return inbound?.ts || null;
}

export function getLastReadAt(thread, lead) {
  return thread?.lastReadAt || lead?.replies_last_read_at || null;
}

export function isThreadUnread(messages, thread, lead = null) {
  const latestKey = getLatestInboundReadKey(messages);
  if (!latestKey) return false;

  const readKeys = ensureReadInboundKeys(thread || {});
  if (readKeys.includes(latestKey)) return false;

  const inboundAt = getLastInboundAt(messages);
  const inboundMs = parseTimeMs(inboundAt);
  const readAt = getLastReadAt(thread, lead);
  const readMs = parseTimeMs(readAt);

  if (readMs != null && inboundMs != null) {
    return inboundMs > readMs;
  }

  const readKey = thread?.lastReadInboundKey;
  if (!readKey) return true;
  return readKey !== latestKey;
}

export function buildThreadReadMeta(messages, thread, lead = null) {
  const lastInboundAt = getLastInboundAt(messages);
  const lastReadAt = getLastReadAt(thread, lead);
  return {
    lastInboundAt,
    lastReadAt,
    lastReadInboundKey: thread?.lastReadInboundKey ?? null,
    readInboundKeys: [...(thread?.readInboundKeys || [])],
    unread: isThreadUnread(messages, thread, lead),
  };
}

function collectInboundReadKeys(messages, upToKey = null) {
  const keys = [];
  for (const message of messages) {
    if (message.direction !== 'inbound') continue;
    const key = inboundReadKey(message);
    if (!key) continue;
    keys.push(key);
    if (upToKey && key === upToKey) break;
  }
  return keys;
}

export async function markThreadRead(rowNumber, inboundKeyOrOptions) {
  const options = typeof inboundKeyOrOptions === 'string'
    ? { inboundKey: inboundKeyOrOptions }
    : (inboundKeyOrOptions || {});

  console.log(`[READ-DIAG] markThreadRead entry: rowNumber=${rowNumber} markAllInbound=${!!options.markAllInbound} inboundKey=${options.inboundKey || '(none)'}`);

  const store = readStore();
  const thread = getThread(store, rowNumber);
  const messages = sortMessages((thread.messages || []).map(normalizeMessage).filter(Boolean));

  console.log(`[READ-DIAG] markThreadRead state: rowNumber=${rowNumber} thread.messages.length=${messages.length} thread.lastReadAt=${thread.lastReadAt}`);

  let inboundKey = options.inboundKey || getLatestInboundReadKey(messages);
  const latestInbound = getLatestInbound(messages);
  const inboundMs = parseTimeMs(latestInbound?.ts);
  const lastReadAt = options.lastReadAt
    || (inboundMs != null ? new Date(inboundMs).toISOString() : new Date().toISOString());

  console.log(`[READ-DIAG] markThreadRead resolved: rowNumber=${rowNumber} inboundKey=${inboundKey || '(null)'} latestInbound.ts=${latestInbound?.ts || '(null)'} lastReadAt=${lastReadAt}`);

  if (!inboundKey && !latestInbound) {
    console.warn(`[READ-DIAG] markThreadRead THROWING: rowNumber=${rowNumber} no inbound messages found`);
    throw new Error('No inbound message to mark read');
  }

  const readKeys = ensureReadInboundKeys(thread);
  const keysToAdd = options.markAllInbound
    ? collectInboundReadKeys(messages)
    : collectInboundReadKeys(messages, inboundKey);
  for (const key of keysToAdd) {
    if (!readKeys.includes(key)) readKeys.push(key);
  }
  if (inboundKey && !readKeys.includes(inboundKey)) {
    readKeys.push(inboundKey);
  }

  thread.lastReadAt = lastReadAt;
  if (inboundKey) {
    thread.lastReadInboundKey = inboundKey;
  } else if (latestInbound) {
    thread.lastReadInboundKey = inboundReadKey(latestInbound);
  }

  store.threads[String(rowNumber)] = thread;
  writeStore(store);
  await persistReadAtToSheet(rowNumber, lastReadAt);

  return {
    lastReadAt: thread.lastReadAt,
    lastReadInboundKey: thread.lastReadInboundKey,
    readInboundKeys: [...readKeys],
    lastInboundAt: getLastInboundAt(messages),
    unread: false,
  };
}

/** Mark every current inbound message in the thread as read (opening a conversation). */
export async function markAllInboundRead(rowNumber) {
  console.log(`[READ-DIAG] markAllInboundRead entry: rowNumber=${rowNumber}`);
  return markThreadRead(rowNumber, { markAllInbound: true });
}

function migrateLegacyViewedKeys(lead, messages, thread, legacyViewedKeys) {
  if ((thread.lastReadAt || thread.lastReadInboundKey) || !legacyViewedKeys?.length) return;
  const row = String(lead.row_number);
  const rowKeys = legacyViewedKeys.filter(k => typeof k === 'string' && k.startsWith(`${row}:`));
  if (!rowKeys.length) return;

  const latestKey = getLatestInboundReadKey(messages);
  if (!latestKey) return;

  const readKeys = ensureReadInboundKeys(thread);
  const inboundAt = getLastInboundAt(messages);
  const smsKey = `${row}:${(lead.sms_reply || '').trim()}`;

  if (rowKeys.includes(smsKey)) {
    thread.lastReadInboundKey = latestKey;
    if (inboundAt) thread.lastReadAt = inboundAt;
    for (const key of collectInboundReadKeys(messages)) {
      if (!readKeys.includes(key)) readKeys.push(key);
    }
    return;
  }

  // Prior client tracked per message id; any viewed key for this row means the thread was opened.
  thread.lastReadInboundKey = latestKey;
  if (inboundAt) thread.lastReadAt = inboundAt;
  for (const key of collectInboundReadKeys(messages)) {
    if (!readKeys.includes(key)) readKeys.push(key);
  }
}

function ensureTemplateMessage(lead, messages) {
  if (!lead.sent || lead.sent === 'imported') return messages;
  const notesKey = (lead.notes || '').toLowerCase().trim();
  const tmplId = `tmpl-${lead.sent}`;
  if (messages.some(m => m.id === tmplId || m.meta?.type === 'template')) return messages;

  const body = TMPL_LABEL[notesKey] || 'Initial message sent';
  const tmpl = normalizeMessage({
    id: tmplId,
    direction: 'outbound',
    channel: 'sms',
    body,
    ts: lead.sent,
    sender: 'Green Shield',
    meta: { type: 'template', templateKey: notesKey, isTemplate: true },
  });
  if (!tmpl) return messages;
  return sortMessages([...messages, tmpl]);
}

function appendInboundIfNew(messages, { channel, body, ts, sender, meta, rowNumber }) {
  const existing = findInboundByContent(messages, channel, body);
  if (existing) return messages;

  const resolvedTs = ts || (rowNumber ? stableInboundTs(rowNumber, channel, body) : new Date().toISOString());
  const normalized = normalizeMessage({
    direction: 'inbound',
    channel,
    body,
    ts: resolvedTs,
    receivedAt: ts ? null : new Date().toISOString(),
    sender,
    meta,
  });
  if (!normalized) return messages;
  if (hasMessage(messages, normalized)) return messages;
  return [...messages, normalized];
}

function recoverAndAppendSheetReply(messages, previousValue, newValue, channel, sender, rowNumber) {
  let next = messages;
  const prev = (previousValue || '').trim();
  const curr = (newValue || '').trim();

  if (prev && prev !== curr && isRealReplyText(prev) && !findInboundByContent(next, channel, prev)) {
    next = appendInboundIfNew(next, { channel, body: prev, sender, rowNumber });
  }

  if (isRealReplyText(curr)) {
    next = appendInboundIfNew(next, { channel, body: curr, sender, rowNumber });
  } else if (isFlagOnly(curr) && !findInboundByContent(next, channel, channel === 'sms' ? '(Customer replied via SMS)' : '(Customer replied via email)')) {
    next = appendInboundIfNew(next, {
      channel,
      body: channel === 'sms' ? '(Customer replied via SMS)' : '(Customer replied via email)',
      sender,
      meta: { flagOnly: true },
      rowNumber,
    });
  }

  return next;
}

/**
 * Sync sheet scalar reply fields into append-only message history.
 * When the sheet overwrites sms_reply/email_reply, recover the previous value once.
 */
export function syncLeadMessages(lead, { legacyViewedKeys } = {}) {
  if (!lead?.row_number) {
    console.warn('[conversationMessages] syncLeadMessages: missing row_number', lead);
    return { messages: [], warnings: ['missing row_number'] };
  }

  const store = readStore();
  const thread = getThread(store, lead.row_number);
  hydrateThreadReadFromLead(thread, lead);
  const warnings = [];
  let messages = Array.isArray(thread.messages)
    ? thread.messages.map(normalizeMessage).filter(Boolean)
    : [];

  messages = ensureTemplateMessage(lead, messages);

  const sms = (lead.sms_reply || '').trim();
  const email = (lead.email_reply || '').trim();

  if (sms && sms !== '.') {
    if (sms !== thread.lastSyncedSmsReply) {
      messages = recoverAndAppendSheetReply(
        messages,
        thread.lastSyncedSmsReply,
        sms,
        'sms',
        lead.name || 'Customer',
        lead.row_number,
      );
      thread.lastSyncedSmsReply = sms;
    }
  }

  if (email && email !== '.') {
    if (email !== thread.lastSyncedEmailReply) {
      messages = recoverAndAppendSheetReply(
        messages,
        thread.lastSyncedEmailReply,
        email,
        'email',
        lead.name || 'Customer',
        lead.row_number,
      );
      thread.lastSyncedEmailReply = email;
    }
  }

  messages = sortMessages(messages);
  thread.messages = messages;
  migrateLegacyViewedKeys(lead, messages, thread, legacyViewedKeys);
  store.threads[String(lead.row_number)] = thread;
  writeStore(store);

  return {
    messages,
    warnings,
    ...buildThreadReadMeta(messages, thread, lead),
  };
}

export function syncLeadsMessages(leads, options = {}) {
  const results = {};
  const meta = {};
  const allWarnings = [];
  for (const lead of leads || []) {
    const { messages, warnings, ...readMeta } = syncLeadMessages(lead, options);
    results[lead.row_number] = messages;
    const thread = readStore().threads[String(lead.row_number)];
    meta[lead.row_number] = {
      ...getConversationPreview(messages),
      ...readMeta,
      lastReadAt: readMeta.lastReadAt ?? thread?.lastReadAt ?? lead.replies_last_read_at ?? null,
      unread: isThreadUnread(messages, thread, lead),
    };
    if (warnings?.length) {
      allWarnings.push({ row_number: lead.row_number, warnings });
    }
  }
  if (allWarnings.length) {
    console.warn('[conversationMessages] sync warnings:', JSON.stringify(allWarnings.slice(0, 5)));
  }
  return { threads: results, meta };
}

export function countUnreadForLeads(leads) {
  const store = readStore();
  let count = 0;
  const rowNumbers = [];
  for (const lead of leads || []) {
    const thread = store.threads[String(lead.row_number)];
    const messages = sortMessages((thread?.messages || []).map(normalizeMessage).filter(Boolean));
    if (isThreadUnread(messages, thread, lead)) {
      count += 1;
      rowNumbers.push(lead.row_number);
    }
  }
  return { count, rowNumbers };
}

export function getMessagesForLead(rowNumber) {
  const store = readStore();
  const thread = store.threads[String(rowNumber)];
  return sortMessages((thread?.messages || []).map(normalizeMessage).filter(Boolean));
}

export function getThreadMeta(rowNumber, lead = null) {
  const store = readStore();
  const thread = store.threads[String(rowNumber)];
  const messages = getMessagesForLead(rowNumber);
  return {
    ...getConversationPreview(messages),
    ...buildThreadReadMeta(messages, thread, lead),
  };
}

export function appendMessage(rowNumber, rawMessage) {
  const normalized = normalizeMessage(rawMessage);
  if (!normalized) {
    throw new Error('Invalid message payload');
  }

  const store = readStore();
  const thread = getThread(store, rowNumber);
  let messages = (thread.messages || []).map(normalizeMessage).filter(Boolean);

  if (!hasMessage(messages, normalized)) {
    messages = sortMessages([...messages, normalized]);
    thread.messages = messages;
    store.threads[String(rowNumber)] = thread;
    writeStore(store);
  }

  return normalized;
}

export function mergeLocalOutboundHistory(localHistory = {}) {
  const store = readStore();
  let merged = 0;

  for (const [rowKey, entry] of Object.entries(localHistory)) {
    const rowNumber = Number(rowKey);
    if (!rowNumber || !entry) continue;
    const thread = getThread(store, rowNumber);
    let messages = (thread.messages || []).map(normalizeMessage).filter(Boolean);

    for (const out of entry.outbound || []) {
      const normalized = normalizeMessage({
        direction: 'outbound',
        channel: 'sms',
        body: out.text,
        ts: out.ts,
        sender: 'You',
        meta: { source: 'localStorage_migrate' },
      });
      if (!normalized || hasMessage(messages, normalized)) continue;
      messages.push(normalized);
      merged += 1;
    }

    thread.messages = sortMessages(messages);
    store.threads[String(rowNumber)] = thread;
  }

  if (merged > 0) {
    writeStore(store);
    console.log(`[conversationMessages] Migrated ${merged} outbound message(s) from localStorage`);
  }

  return { merged };
}

export function getConversationPreview(messages) {
  const sorted = sortMessages(messages);
  if (!sorted.length) {
    return { preview: '', lastAt: null, lastMessage: null };
  }
  const last = sorted[sorted.length - 1];
  const preview = last.body.length > 120 ? `${last.body.slice(0, 120)}…` : last.body;
  return { preview, lastAt: last.receivedAt || last.ts, lastMessage: last };
}
