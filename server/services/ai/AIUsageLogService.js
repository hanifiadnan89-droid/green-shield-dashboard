import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createError } from '../errorLogRecorder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const DEFAULT_DATA_DIR = path.join(SERVER_DIR, 'data');
const USAGE_FILE_NAME = 'ai-usage-log.json';
const REQUIRED_RENDER_BACKEND = 'persistent_disk';
const REQUIRED_RENDER_KB_DATA_DIR = '/var/data/knowledge-base';
const MAX_ENTRIES = 5000;
const SAFE_USAGE_METADATA_KEYS = new Set([
  'inputCount',
  'fileSizeBytes',
  'extension',
  'deprecatedRoute',
  'deprecatedPath',
  'replacementPath',
]);

let startupLogged = false;
let unsafeWarningLogged = false;
let unsafeErrorCenterRecorded = false;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWriteJsonFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeBackend(value) {
  const backend = String(value || '').trim().toLowerCase();
  if (['file', 'persistent_disk', 'postgres'].includes(backend)) return backend;
  if (process.env.KNOWLEDGE_STORAGE_BACKEND) return String(process.env.KNOWLEDGE_STORAGE_BACKEND).trim().toLowerCase();
  return 'file';
}

function resolveUsageDataDir() {
  const configured = process.env.AI_USAGE_LOG_DATA_DIR;
  if (configured && configured.trim()) {
    return { dataDir: path.resolve(configured.trim()), configured: true, source: 'AI_USAGE_LOG_DATA_DIR' };
  }
  const knowledgeDataDir = process.env.KNOWLEDGE_DATA_DIR;
  if (knowledgeDataDir && knowledgeDataDir.trim()) {
    return {
      dataDir: path.join(path.resolve(knowledgeDataDir.trim()), 'ai-usage'),
      configured: true,
      source: 'KNOWLEDGE_DATA_DIR',
    };
  }
  return { dataDir: DEFAULT_DATA_DIR, configured: false, source: 'default' };
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isRenderConfigValid(status) {
  if (process.env.AI_USAGE_LOG_DATA_DIR && process.env.AI_USAGE_LOG_DATA_DIR.trim()) {
    return !status.inRepo && status.backend === REQUIRED_RENDER_BACKEND;
  }
  return (
    status.backend === REQUIRED_RENDER_BACKEND
    && process.env.KNOWLEDGE_DATA_DIR
    && path.resolve(process.env.KNOWLEDGE_DATA_DIR) === path.resolve(REQUIRED_RENDER_KB_DATA_DIR)
  );
}

export function getAIUsageLogStorageStatus() {
  const backend = normalizeBackend(process.env.AI_USAGE_LOG_STORAGE_BACKEND);
  const { dataDir, configured, source } = resolveUsageDataDir();
  const render = Boolean(process.env.RENDER);
  const production = process.env.NODE_ENV === 'production';
  const inRepo = isPathInside(dataDir, SERVER_DIR);
  const status = {
    backend,
    dataDir,
    filePath: path.join(dataDir, USAGE_FILE_NAME),
    configured,
    source,
    render,
    production,
    inRepo,
    renderConfigValid: false,
    writeSafe: true,
    warning: null,
  };
  status.renderConfigValid = isRenderConfigValid(status);
  status.writeSafe = !(render && production && !status.renderConfigValid);
  status.warning = status.writeSafe
    ? inRepo
      ? 'AI usage log is using local development storage inside the application repository. Do not use this for production usage history on Render.'
      : null
    : 'AI usage log production writes are disabled. Configure durable storage with AI_USAGE_LOG_STORAGE_BACKEND=persistent_disk and AI_USAGE_LOG_DATA_DIR on a Render persistent disk, or set KNOWLEDGE_STORAGE_BACKEND=persistent_disk and KNOWLEDGE_DATA_DIR=/var/data/knowledge-base.';
  return status;
}

export function initializeAIUsageLogStorage() {
  const status = getAIUsageLogStorageStatus();
  if (!startupLogged) {
    startupLogged = true;
    const level = status.writeSafe ? 'log' : 'warn';
    console[level](`[aiUsageLog] backend=${status.backend} dataDir=${status.dataDir} file=${status.filePath}`);
    if (status.warning) console[level](`[aiUsageLog] ${status.warning}`);
  }
  if (!status.writeSafe) return status;
  ensureDir(status.dataDir);
  if (!fs.existsSync(status.filePath)) atomicWriteJsonFile(status.filePath, []);
  return status;
}

export function resetAIUsageLogServiceForTests() {
  startupLogged = false;
  unsafeWarningLogged = false;
  unsafeErrorCenterRecorded = false;
}

const SAFE_STORAGE_STATUS_FIELDS = [
  'backend',
  'configured',
  'source',
  'render',
  'production',
  'inRepo',
  'writeSafe',
  'warning',
];

export function getSafeAIUsageLogStorageStatus() {
  const status = getAIUsageLogStorageStatus();
  const safe = {};
  for (const key of SAFE_STORAGE_STATUS_FIELDS) {
    safe[key] = status[key] ?? null;
  }
  return safe;
}

function reportUnsafeStorageToErrorCenter(status) {
  if (unsafeErrorCenterRecorded) return;
  unsafeErrorCenterRecorded = true;
  try {
    createError({
      source: 'ai',
      module: 'ai-usage-log',
      severity: 'high',
      errorCode: 'AI_USAGE_LOG_STORAGE_UNSAFE',
      message: status.warning || 'AI usage log storage is not write-safe.',
      rawMetadata: {
        backend: status.backend,
        configured: status.configured,
        source: status.source,
        render: status.render,
        production: status.production,
        inRepo: status.inRepo,
        writeSafe: status.writeSafe,
      },
    });
  } catch (err) {
    console.warn('[aiUsageLog] error center notification failed:', err?.message || err);
  }
}

function readEntries() {
  initializeAIUsageLogStorage();
  return readJsonArray(getAIUsageLogStorageStatus().filePath);
}

function writeEntries(entries) {
  const status = getAIUsageLogStorageStatus();
  if (!status.writeSafe) return;
  ensureDir(status.dataDir);
  const trimmed = entries.length > MAX_ENTRIES ? entries.slice(0, MAX_ENTRIES) : entries;
  atomicWriteJsonFile(status.filePath, trimmed);
}

function nonEmptyString(value, fallback = null) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function safePositiveNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

function safeBoolean(value) {
  return value === true;
}

function safePath(value) {
  const trimmed = nonEmptyString(value);
  if (!trimmed) return null;
  if (!trimmed.startsWith('/')) return null;
  if (!/^\/[A-Za-z0-9/_:.-]+$/.test(trimmed)) return null;
  return trimmed;
}

function safeExtension(value) {
  const trimmed = nonEmptyString(value);
  if (!trimmed) return null;
  if (!/^[A-Za-z0-9.+_-]{1,32}$/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeUsageMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const out = {};
  for (const key of SAFE_USAGE_METADATA_KEYS) {
    if (metadata[key] === undefined || metadata[key] === null) continue;
    if (key === 'deprecatedRoute') {
      if (safeBoolean(metadata[key])) out[key] = true;
    } else if (key === 'deprecatedPath' || key === 'replacementPath') {
      const value = safePath(metadata[key]);
      if (value) out[key] = value;
    } else if (key === 'inputCount' || key === 'fileSizeBytes') {
      out[key] = safePositiveNumber(metadata[key]);
    } else if (key === 'extension') {
      const value = safeExtension(metadata[key]);
      if (value) out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function makeUsageId() {
  return `ai_usage_${crypto.randomBytes(8).toString('hex')}`;
}

function normalizeSuccess(value, errorCode) {
  if (typeof value === 'boolean') return value;
  return !errorCode;
}

function buildEntry(input = {}) {
  const timestamp = input.timestamp || new Date().toISOString();
  const errorCode = nonEmptyString(input.errorCode);
  const success = normalizeSuccess(input.success, errorCode);
  const entry = {
    id: makeUsageId(),
    timestamp,
    endpoint: nonEmptyString(input.endpoint),
    feature: nonEmptyString(input.feature),
    provider: nonEmptyString(input.provider),
    model: nonEmptyString(input.model),
    durationMs: safePositiveNumber(input.durationMs),
    inputSize: safePositiveNumber(input.inputSize),
    outputSize: safePositiveNumber(input.outputSize),
    success,
    errorCode: success ? null : errorCode,
    status: success ? 'success' : 'failure',
  };

  const requestId = nonEmptyString(input.requestId);
  if (requestId) entry.requestId = requestId;
  const organizationId = nonEmptyString(input.organizationId);
  if (organizationId) entry.organizationId = organizationId;
  const userId = nonEmptyString(input.userId);
  if (userId) entry.userId = userId;
  const source = nonEmptyString(input.source);
  if (source) entry.source = source;

  if (input.metadata && typeof input.metadata === 'object') {
    const sanitized = sanitizeUsageMetadata(input.metadata);
    if (sanitized) {
      entry.metadata = sanitized;
    }
  }

  return entry;
}

export function recordAIUsage(input = {}) {
  const status = getAIUsageLogStorageStatus();
  if (!status.writeSafe) {
    if (!unsafeWarningLogged) {
      unsafeWarningLogged = true;
      console.warn(`[aiUsageLog] ${status.warning}`);
    }
    reportUnsafeStorageToErrorCenter(status);
    return null;
  }
  const entry = buildEntry(input);
  const entries = readEntries();
  entries.unshift(entry);
  writeEntries(entries);
  return entry;
}

// Exported for AIUsageRecorder: when the current-store write is refused
// (writeSafe=false on Render staging with the file backend unconfigured), the
// recorder still needs to build a shaped, sanitized entry it can shadow-write
// to Postgres. Uses the exact same normalization as the primary path so
// endpoint / feature / provider / model / sizes / success align with the
// ai_usage_logs schema.
export function buildAIUsageEntry(input = {}) {
  return buildEntry(input);
}

function matchesFilters(entry, filters) {
  if (filters.feature && String(entry.feature || '').toLowerCase() !== String(filters.feature).toLowerCase()) return false;
  if (filters.provider && String(entry.provider || '').toLowerCase() !== String(filters.provider).toLowerCase()) return false;
  if (filters.model && String(entry.model || '').toLowerCase() !== String(filters.model).toLowerCase()) return false;
  if (filters.endpoint && String(entry.endpoint || '').toLowerCase() !== String(filters.endpoint).toLowerCase()) return false;
  if (filters.success != null) {
    const wanted = filters.success === true || filters.success === 'true';
    if (Boolean(entry.success) !== wanted) return false;
  }
  if (filters.from) {
    const fromMs = new Date(filters.from).getTime();
    if (Number.isFinite(fromMs) && new Date(entry.timestamp).getTime() < fromMs) return false;
  }
  if (filters.to) {
    const toMs = new Date(filters.to).getTime();
    if (Number.isFinite(toMs) && new Date(entry.timestamp).getTime() > toMs) return false;
  }
  return true;
}

export function listAIUsage(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
  const entries = readEntries().filter((entry) => matchesFilters(entry, filters));
  return entries.slice(0, limit);
}

function bucket(counts, key) {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
}

export function summarizeAIUsage(filters = {}) {
  const entries = readEntries().filter((entry) => matchesFilters(entry, filters));
  const summary = {
    total: entries.length,
    success: 0,
    failure: 0,
    averageDurationMs: 0,
    byFeature: {},
    byProvider: {},
    byErrorCode: {},
  };

  let totalDuration = 0;
  let durationSamples = 0;

  for (const entry of entries) {
    if (entry.success) summary.success += 1;
    else summary.failure += 1;
    bucket(summary.byFeature, entry.feature);
    bucket(summary.byProvider, entry.provider);
    if (!entry.success && entry.errorCode) bucket(summary.byErrorCode, entry.errorCode);
    if (Number.isFinite(entry.durationMs) && entry.durationMs >= 0) {
      totalDuration += entry.durationMs;
      durationSamples += 1;
    }
  }

  summary.averageDurationMs = durationSamples > 0 ? Math.round(totalDuration / durationSamples) : 0;
  return summary;
}

export default {
  recordAIUsage,
  listAIUsage,
  summarizeAIUsage,
  getAIUsageLogStorageStatus,
  getSafeAIUsageLogStorageStatus,
  initializeAIUsageLogStorage,
  resetAIUsageLogServiceForTests,
};
