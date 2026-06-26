import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const TRAINING_FILE = path.join(DATA_DIR, 'training-items.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sales-coach-sessions.json');

// ── File I/O helpers ──────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ── Training Items ────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'principle',
  'approved_response',
  'correction',
  'objection_example',
  'playbook_seed',
]);

const UPDATABLE_FIELDS = ['title', 'content', 'context', 'category', 'service', 'tags', 'active'];

export function listTrainingItems({ type } = {}) {
  const items = readJson(TRAINING_FILE);
  if (type) return items.filter(i => i.type === type);
  return items;
}

export function createTrainingItem({ type, title, content, context = null, category = null, service = null, tags = [] }) {
  if (!ALLOWED_TYPES.has(type)) {
    throw Object.assign(new Error(`type must be one of: ${[...ALLOWED_TYPES].join(', ')}`), { code: 'INVALID_TYPE' });
  }
  if (!title?.trim()) throw new Error('title is required');
  if (!content?.trim()) throw new Error('content is required');

  const now = new Date().toISOString();
  const item = {
    id: `ti-${crypto.randomUUID().slice(0, 8)}`,
    type,
    title: title.trim(),
    content: content.trim(),
    context: context?.trim() || null,
    category: category || null,
    service: service || null,
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  const items = readJson(TRAINING_FILE);
  items.push(item);
  writeJson(TRAINING_FILE, items);
  return item;
}

export function updateTrainingItem(id, updates) {
  const items = readJson(TRAINING_FILE);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) throw Object.assign(new Error(`Training item not found: ${id}`), { code: 'NOT_FOUND' });

  const patch = {};
  for (const field of UPDATABLE_FIELDS) {
    if (field in updates) patch[field] = updates[field];
  }
  if (patch.title)   patch.title   = patch.title.trim();
  if (patch.content) patch.content = patch.content.trim();
  if (patch.context) patch.context = patch.context.trim();
  patch.updatedAt = new Date().toISOString();

  items[idx] = { ...items[idx], ...patch };
  writeJson(TRAINING_FILE, items);
  return items[idx];
}

export function deleteTrainingItem(id) {
  const items = readJson(TRAINING_FILE);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) throw Object.assign(new Error(`Training item not found: ${id}`), { code: 'NOT_FOUND' });
  items.splice(idx, 1);
  writeJson(TRAINING_FILE, items);
  return { success: true, id };
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function upsertSession(sessionId, updates) {
  if (!sessionId) return;
  const sessions = readJson(SESSIONS_FILE);
  const idx = sessions.findIndex(s => s.id === sessionId);
  const now = new Date().toISOString();

  if (idx === -1) {
    sessions.unshift({
      id: sessionId,
      module: updates.module || null,
      situation: updates.situation || null,
      serviceType: updates.serviceType || null,
      result: updates.result || null,
      feedback: updates.feedback || null,
      outcome: updates.outcome || null,
      status: updates.status || 'active',
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const existing = sessions[idx];
    sessions[idx] = {
      ...existing,
      ...(updates.module    !== undefined && { module:    updates.module }),
      ...(updates.situation !== undefined && { situation: updates.situation }),
      ...(updates.serviceType !== undefined && { serviceType: updates.serviceType }),
      ...(updates.result    !== undefined && { result:    updates.result }),
      ...(updates.feedback  !== undefined && { feedback:  updates.feedback }),
      ...(updates.outcome   !== undefined && { outcome:   updates.outcome }),
      ...(updates.status    !== undefined && { status:    updates.status }),
      updatedAt: now,
    };
  }

  writeJson(SESSIONS_FILE, sessions);
}

export function listSessions({ limit = 20, module: moduleFilter = null } = {}) {
  const sessions = readJson(SESSIONS_FILE);
  const filtered = moduleFilter ? sessions.filter(s => s.module === moduleFilter) : sessions;
  return filtered.slice(0, limit);
}

// ── Training Context for AI ───────────────────────────────────────────────────

const KEYWORD_STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'it', 'to', 'i', 'my', 'we', 'they', 'he', 'she', 'and', 'or', 'but', 'in', 'on', 'for', 'of', 'with', 'this', 'that', 'do', 'not', 'can', 'are', 'was', 'be', 'have', 'has', 'had', 'will', 'just']);

function extractKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !KEYWORD_STOP_WORDS.has(w));
}

function scoreItem(item, situationKeywords) {
  if (!item.active) return -1;
  const itemText = `${item.title} ${item.content} ${item.context || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
  const matches = situationKeywords.filter(kw => itemText.includes(kw)).length;
  return matches;
}

export function getTrainingContext(situation, { service } = {}) {
  const items = readJson(TRAINING_FILE);
  const activeItems = items.filter(i => i.active);
  if (activeItems.length === 0) return null;

  const situationKeywords = extractKeywords(situation || '');
  const serviceKeywords = service ? extractKeywords(service) : [];
  const allKeywords = [...situationKeywords, ...serviceKeywords];

  const principles = activeItems.filter(i => i.type === 'principle');

  const scored = activeItems
    .filter(i => i.type !== 'principle')
    .map(i => ({ item: i, score: scoreItem(i, allKeywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item }) => item);

  const selected = [...principles.slice(0, 3), ...scored];
  if (selected.length === 0) return null;

  const TYPE_LABELS = {
    principle: 'SALES PRINCIPLE',
    approved_response: 'APPROVED RESPONSE',
    correction: 'CORRECTION / WHAT NOT TO DO',
    objection_example: 'OBJECTION EXAMPLE',
    playbook_seed: 'PLAYBOOK STRATEGY',
  };

  const lines = ['TEAM TRAINING CONTEXT (curated by your sales manager — use these to inform tone and strategy):'];
  for (const item of selected) {
    lines.push('');
    lines.push(`[${TYPE_LABELS[item.type] || item.type.toUpperCase()}] ${item.title}`);
    lines.push(item.content);
    if (item.context) lines.push(`Context: ${item.context}`);
  }
  lines.push('');
  lines.push('Use the above as strategic guidance only. Never directly quote or reproduce approved responses verbatim. Adapt them to the current situation.');

  return lines.join('\n');
}
