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
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
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

function sortMessages(messages) {
  return [...messages].sort((a, b) => {
    const ta = new Date(a.ts).getTime();
    const tb = new Date(b.ts).getTime();
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
    };
  }
  return store.threads[key];
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

function appendInboundIfNew(messages, { channel, body, ts, sender, meta }) {
  const normalized = normalizeMessage({
    direction: 'inbound',
    channel,
    body,
    ts: ts || new Date().toISOString(),
    sender,
    meta,
  });
  if (!normalized || hasMessage(messages, normalized)) return messages;
  return [...messages, normalized];
}

function recoverAndAppendSheetReply(messages, previousValue, newValue, channel, sender) {
  let next = messages;
  const prev = (previousValue || '').trim();
  const curr = (newValue || '').trim();

  if (prev && prev !== curr && isRealReplyText(prev) && !next.some(m => m.direction === 'inbound' && m.channel === channel && m.body === prev)) {
    next = appendInboundIfNew(next, { channel, body: prev, ts: new Date(Date.now() - 1000).toISOString(), sender });
  }

  if (isRealReplyText(curr)) {
    next = appendInboundIfNew(next, { channel, body: curr, sender });
  } else if (isFlagOnly(curr) && !next.some(m => m.direction === 'inbound' && m.channel === channel)) {
    next = appendInboundIfNew(next, {
      channel,
      body: channel === 'sms' ? '(Customer replied via SMS)' : '(Customer replied via email)',
      sender,
      meta: { flagOnly: true },
    });
  }

  return next;
}

/**
 * Sync sheet scalar reply fields into append-only message history.
 * When the sheet overwrites sms_reply/email_reply, recover the previous value once.
 */
export function syncLeadMessages(lead) {
  if (!lead?.row_number) {
    console.warn('[conversationMessages] syncLeadMessages: missing row_number', lead);
    return { messages: [], warnings: ['missing row_number'] };
  }

  const store = readStore();
  const thread = getThread(store, lead.row_number);
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
      );
      thread.lastSyncedEmailReply = email;
    }
  }

  messages = sortMessages(messages);
  thread.messages = messages;
  store.threads[String(lead.row_number)] = thread;
  writeStore(store);

  return { messages, warnings };
}

export function syncLeadsMessages(leads) {
  const results = {};
  const allWarnings = [];
  for (const lead of leads || []) {
    const { messages, warnings } = syncLeadMessages(lead);
    results[lead.row_number] = messages;
    if (warnings?.length) {
      allWarnings.push({ row_number: lead.row_number, warnings });
    }
  }
  if (allWarnings.length) {
    console.warn('[conversationMessages] sync warnings:', JSON.stringify(allWarnings.slice(0, 5)));
  }
  return results;
}

export function getMessagesForLead(rowNumber) {
  const store = readStore();
  const thread = store.threads[String(rowNumber)];
  return sortMessages((thread?.messages || []).map(normalizeMessage).filter(Boolean));
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
  return { preview, lastAt: last.ts, lastMessage: last };
}
