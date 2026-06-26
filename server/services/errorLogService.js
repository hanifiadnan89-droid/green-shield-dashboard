import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const DEFAULT_DATA_DIR = path.join(SERVER_DIR, 'data');
const ERROR_FILE_NAME = 'crm-error-log.json';
const REQUIRED_RENDER_BACKEND = 'persistent_disk';
const REQUIRED_RENDER_KB_DATA_DIR = '/var/data/knowledge-base';

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);
const STATUSES = new Set(['new', 'investigating', 'resolved', 'ignored', 'archived']);
const SOURCES = new Set([
  'frontend',
  'backend',
  'api',
  'ai',
  'sheets',
  'n8n',
  'twilio',
  'gmail',
  'fieldroutes',
  'pdf',
  'kb',
  'signing',
  'route-finder',
]);

const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|auth[_-]?token|password|secret|token|cookie|session|gmail_app_password|twilio_auth_token)/i;
const SECRET_VALUE_PATTERN = /(Bearer\s+[A-Za-z0-9._~+/=-]+|Basic\s+[A-Za-z0-9+/=-]+|sk-[A-Za-z0-9_-]+)/gi;

let startupLogged = false;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWriteJsonFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeBackend(value) {
  const backend = String(value || '').trim().toLowerCase();
  if (['file', 'persistent_disk', 'postgres'].includes(backend)) return backend;
  if (process.env.KNOWLEDGE_STORAGE_BACKEND) return String(process.env.KNOWLEDGE_STORAGE_BACKEND).trim().toLowerCase();
  return 'file';
}

function resolveErrorDataDir() {
  const configured = process.env.ERROR_LOG_DATA_DIR;
  if (configured && configured.trim()) {
    return { dataDir: path.resolve(configured.trim()), configured: true, source: 'ERROR_LOG_DATA_DIR' };
  }

  const knowledgeDataDir = process.env.KNOWLEDGE_DATA_DIR;
  if (knowledgeDataDir && knowledgeDataDir.trim()) {
    return {
      dataDir: path.join(path.resolve(knowledgeDataDir.trim()), 'error-center'),
      configured: true,
      source: 'KNOWLEDGE_DATA_DIR',
    };
  }

  return { dataDir: DEFAULT_DATA_DIR, configured: false, source: 'default' };
}

function isRenderConfigValid(status) {
  if (process.env.ERROR_LOG_DATA_DIR && process.env.ERROR_LOG_DATA_DIR.trim()) {
    return !status.inRepo && status.backend === REQUIRED_RENDER_BACKEND;
  }
  return (
    status.backend === REQUIRED_RENDER_BACKEND
    && process.env.KNOWLEDGE_DATA_DIR
    && path.resolve(process.env.KNOWLEDGE_DATA_DIR) === path.resolve(REQUIRED_RENDER_KB_DATA_DIR)
  );
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function getErrorLogStorageStatus() {
  const backend = normalizeBackend(process.env.ERROR_LOG_STORAGE_BACKEND);
  const { dataDir, configured, source } = resolveErrorDataDir();
  const render = Boolean(process.env.RENDER);
  const production = process.env.NODE_ENV === 'production';
  const inRepo = isPathInside(dataDir, SERVER_DIR);
  const status = {
    backend,
    dataDir,
    filePath: path.join(dataDir, ERROR_FILE_NAME),
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
      ? 'Error Center is using local development storage inside the application repository. Do not use this for production error history on Render.'
      : null
    : 'Error Center production writes are disabled. Configure durable storage with ERROR_LOG_STORAGE_BACKEND=persistent_disk and ERROR_LOG_DATA_DIR on a Render persistent disk, or set KNOWLEDGE_STORAGE_BACKEND=persistent_disk and KNOWLEDGE_DATA_DIR=/var/data/knowledge-base.';
  return status;
}

export function initializeErrorLogStorage() {
  const status = getErrorLogStorageStatus();
  if (!startupLogged) {
    startupLogged = true;
    const level = status.writeSafe ? 'log' : 'error';
    console[level](`[errorLog] backend=${status.backend} dataDir=${status.dataDir} file=${status.filePath}`);
    if (status.warning) console.error(`[errorLog] ${status.warning}`);
  }
  if (!status.writeSafe) return status;
  ensureDir(status.dataDir);
  if (!fs.existsSync(status.filePath)) atomicWriteJsonFile(status.filePath, []);
  return status;
}

function assertWritable() {
  const status = getErrorLogStorageStatus();
  if (!status.writeSafe) {
    const err = new Error(status.warning);
    err.code = 'ERROR_LOG_STORAGE_UNSAFE';
    err.status = 503;
    throw err;
  }
  ensureDir(status.dataDir);
  return status;
}

function sanitizeText(value) {
  return String(value || '').replace(SECRET_VALUE_PATTERN, '[REDACTED]');
}

export function sanitizeMetadata(value, depth = 0) {
  if (depth > 6) return '[Max depth exceeded]';
  if (value == null) return value;
  if (typeof value === 'string') return sanitizeText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitizeMetadata(raw, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function normalizeSeverity(value, httpStatus) {
  const severity = String(value || '').toLowerCase();
  if (SEVERITIES.has(severity)) return severity;
  if (httpStatus >= 500) return 'high';
  if (httpStatus >= 400) return 'medium';
  return 'info';
}

function normalizeStatus(value) {
  const status = String(value || 'new').toLowerCase();
  return STATUSES.has(status) ? status : 'new';
}

function normalizeSource(value) {
  const source = String(value || 'backend').toLowerCase();
  return SOURCES.has(source) ? source : 'backend';
}

function normalizeMessage(message) {
  return sanitizeText(message || 'Unknown error')
    .replace(/\b[0-9a-f]{8,}\b/gi, ':id')
    .replace(/\b\d{4,}\b/g, ':number')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

function makeDedupKey(record) {
  return [
    record.source,
    record.module || record.page || '',
    record.endpoint || '',
    record.errorCode || '',
    normalizeMessage(record.message),
  ].join('|').toLowerCase();
}

function makeId(dedupKey) {
  return `err_${crypto.createHash('sha256').update(dedupKey).digest('hex').slice(0, 16)}`;
}

function getAppVersion() {
  return process.env.APP_VERSION || process.env.npm_package_version || '1.0.0';
}

function getEnvironmentName() {
  if (process.env.APP_ENV) return process.env.APP_ENV;
  if (process.env.RENDER && process.env.NODE_ENV === 'production') return 'production';
  return process.env.NODE_ENV || 'local';
}

function getDeploymentMetadata() {
  return sanitizeMetadata({
    gitCommitHash: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.COMMIT_SHA || '',
    appVersion: getAppVersion(),
    deploymentId: process.env.RENDER_DEPLOY_ID || process.env.DEPLOYMENT_ID || process.env.RENDER_SERVICE_ID || '',
    environment: getEnvironmentName(),
    hostname: os.hostname(),
    serverInstance: process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || os.hostname(),
    processUptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
  });
}

function decorateTime(record, now = new Date()) {
  const timestamp = record.timestamp || now.toISOString();
  const dateObj = new Date(timestamp);
  return {
    timestamp: dateObj.toISOString(),
    date: dateObj.toISOString().slice(0, 10),
    time: dateObj.toISOString().slice(11, 19),
  };
}

function readErrors() {
  initializeErrorLogStorage();
  return readJsonFile(getErrorLogStorageStatus().filePath, []);
}

function writeErrors(errors) {
  const status = assertWritable();
  atomicWriteJsonFile(status.filePath, errors);
}

function makeTimelineEntry({ oldStatus = null, newStatus, user = 'system', note = '', timestamp = new Date().toISOString() }) {
  return {
    timestamp,
    user: sanitizeText(user || 'system'),
    oldStatus,
    newStatus,
    note: sanitizeText(note || ''),
  };
}

export function createError(input = {}) {
  const now = new Date();
  const httpStatus = Number(input.httpStatus || input.statusCode || input.status) || null;
  const timeParts = decorateTime(input, now);
  const source = normalizeSource(input.source);
  const record = {
    id: '',
    ...timeParts,
    severity: normalizeSeverity(input.severity, httpStatus),
    status: normalizeStatus(input.status),
    source,
    page: sanitizeText(input.page || ''),
    module: sanitizeText(input.module || input.page || ''),
    endpoint: sanitizeText(input.endpoint || ''),
    httpStatus,
    errorCode: sanitizeText(input.errorCode || input.code || ''),
    message: normalizeMessage(input.message || input.error || 'Unknown error'),
    stackTrace: source === 'frontend' ? '' : input.stackTrace ? sanitizeText(input.stackTrace).slice(0, 12000) : '',
    userFacingMessage: sanitizeText(input.userFacingMessage || ''),
    technicalDetails: sanitizeMetadata(input.technicalDetails || null),
    requestId: sanitizeText(input.requestId || ''),
    relatedLead: sanitizeMetadata(input.relatedLead || input.lead || null),
    relatedCustomer: sanitizeMetadata(input.relatedCustomer || input.customer || null),
    suggestedFix: sanitizeText(input.suggestedFix || ''),
    likelyCause: sanitizeText(input.likelyCause || ''),
    rawMetadata: sanitizeMetadata(input.rawMetadata || input.metadata || {}),
    deployment: getDeploymentMetadata(),
    timeline: [],
    aiAnalysis: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    firstSeenAt: timeParts.timestamp,
    lastSeenAt: timeParts.timestamp,
    occurrenceCount: 1,
    archived: false,
  };
  const dedupKey = makeDedupKey(record);
  record.id = makeId(dedupKey);
  record.dedupKey = dedupKey;
  record.timeline = [
    makeTimelineEntry({
      oldStatus: null,
      newStatus: record.status,
      user: input.user || 'system',
      note: 'Error first recorded.',
      timestamp: record.createdAt,
    }),
  ];

  const errors = readErrors();
  const existingIndex = errors.findIndex((item) => item.dedupKey === dedupKey && item.status !== 'archived');
  if (existingIndex >= 0) {
    const existing = errors[existingIndex];
    const merged = {
      ...existing,
      ...record,
      id: existing.id,
      status: existing.status === 'resolved' || existing.status === 'ignored' ? existing.status : record.status,
      createdAt: existing.createdAt,
      firstSeenAt: existing.firstSeenAt,
      deployment: existing.deployment || record.deployment,
      timeline: Array.isArray(existing.timeline) ? existing.timeline : [],
      aiAnalysis: existing.aiAnalysis || null,
      occurrenceCount: Number(existing.occurrenceCount || 1) + 1,
      updatedAt: now.toISOString(),
      lastSeenAt: timeParts.timestamp,
    };
    errors[existingIndex] = merged;
    writeErrors(errors);
    return merged;
  }

  errors.unshift(record);
  writeErrors(errors.slice(0, 5000));
  return record;
}

export function listErrors(filters = {}) {
  let errors = readErrors();
  if (!filters.includeArchived) {
    errors = errors.filter((error) => error.status !== 'archived' && !error.archived);
  }
  for (const key of ['severity', 'status', 'source', 'module']) {
    if (filters[key]) {
      const expected = String(filters[key]).toLowerCase();
      errors = errors.filter((error) => String(error[key] || '').toLowerCase() === expected);
    }
  }
  if (filters.date) {
    errors = errors.filter((error) => error.date === filters.date);
  }
  if (filters.query) {
    const query = String(filters.query).toLowerCase();
    errors = errors.filter((error) => [
      error.message,
      error.errorCode,
      error.module,
      error.page,
      error.endpoint,
      error.relatedLead?.name,
      error.relatedCustomer?.name,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }
  const total = errors.length;
  const limit = Math.min(Number(filters.limit) || 100, 500);
  const offset = Math.max(Number(filters.offset) || 0, 0);
  return { errors: errors.slice(offset, offset + limit), total };
}

export function getErrorDetail(id) {
  return readErrors().find((error) => error.id === id) || null;
}

export function updateErrorStatus(id, status, options = {}) {
  const normalized = normalizeStatus(status);
  const errors = readErrors();
  const index = errors.findIndex((error) => error.id === id);
  if (index < 0) return null;
  const oldStatus = errors[index].status || 'new';
  const timestamp = new Date().toISOString();
  const timeline = Array.isArray(errors[index].timeline) ? errors[index].timeline : [];
  errors[index] = {
    ...errors[index],
    status: normalized,
    archived: normalized === 'archived',
    updatedAt: timestamp,
    resolvedAt: normalized === 'resolved' ? (errors[index].resolvedAt || timestamp) : errors[index].resolvedAt,
    timeline: [
      ...timeline,
      makeTimelineEntry({
        oldStatus,
        newStatus: normalized,
        user: options.user || 'system',
        note: options.note || options.resolutionNote || '',
        timestamp,
      }),
    ],
  };
  writeErrors(errors);
  return errors[index];
}

export const markErrorResolved = (id, options = {}) => updateErrorStatus(id, 'resolved', options);
export const archiveError = (id, options = {}) => updateErrorStatus(id, 'archived', options);

function startOfTodayMs() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getMostCommon(errors, selector) {
  const counts = new Map();
  for (const error of errors) {
    const key = selector(error) || 'Unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let top = { value: 'None', count: 0 };
  for (const [value, count] of counts.entries()) {
    if (count > top.count) top = { value, count };
  }
  return top;
}

function calculateMttrMs(errors) {
  const resolvedDurations = errors
    .filter((error) => error.resolvedAt && error.firstSeenAt)
    .map((error) => new Date(error.resolvedAt).getTime() - new Date(error.firstSeenAt).getTime())
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (!resolvedDurations.length) return null;
  return Math.round(resolvedDurations.reduce((sum, value) => sum + value, 0) / resolvedDurations.length);
}

export function summarizeErrors() {
  const errors = readErrors().filter((error) => error.status !== 'archived' && !error.archived);
  const now = Date.now();
  const since = now - 24 * 60 * 60 * 1000;
  const since7d = now - 7 * 24 * 60 * 60 * 1000;
  const today = startOfTodayMs();
  const active = errors.filter((error) => !['resolved', 'ignored'].includes(error.status));
  const mostFrequent = getMostCommon(errors, (error) => error.message);
  return {
    total: errors.length,
    critical: errors.filter((error) => error.severity === 'critical').length,
    unresolved: errors.filter((error) => !['resolved', 'ignored'].includes(error.status)).length,
    last24Hours: errors.filter((error) => new Date(error.lastSeenAt || error.timestamp).getTime() >= since).length,
    activeCritical: active.filter((error) => error.severity === 'critical').length,
    activeHigh: active.filter((error) => error.severity === 'high').length,
    errorsToday: errors.filter((error) => new Date(error.lastSeenAt || error.timestamp).getTime() >= today).length,
    resolvedToday: errors.filter((error) => error.resolvedAt && new Date(error.resolvedAt).getTime() >= today).length,
    mttrMs: calculateMttrMs(errors),
    mostFailingModule: getMostCommon(errors, (error) => error.module || error.page),
    mostFrequentError: mostFrequent,
    errorTrend: {
      last24Hours: errors.filter((error) => new Date(error.lastSeenAt || error.timestamp).getTime() >= since).length,
      last7Days: errors.filter((error) => new Date(error.lastSeenAt || error.timestamp).getTime() >= since7d).length,
    },
  };
}

function tokenizeSimilarity(value) {
  return new Set(normalizeMessage(value).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function findSimilarErrors(id, limit = 5) {
  const errors = readErrors();
  const current = errors.find((error) => error.id === id);
  if (!current) return [];
  const currentTokens = tokenizeSimilarity(`${current.message}\n${current.stackTrace || ''}`);
  return errors
    .filter((error) => error.id !== id && error.status !== 'archived')
    .map((error) => {
      const score = Math.max(
        jaccard(currentTokens, tokenizeSimilarity(`${error.message}\n${error.stackTrace || ''}`)),
        error.errorCode && error.errorCode === current.errorCode ? 0.65 : 0,
        error.module && error.module === current.module ? 0.25 : 0,
      );
      return { ...error, similarityScore: Number(score.toFixed(3)) };
    })
    .filter((error) => error.similarityScore >= 0.25)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, Math.min(Number(limit) || 5, 20));
}

export function setErrorAnalysis(id, analysis) {
  const errors = readErrors();
  const index = errors.findIndex((error) => error.id === id);
  if (index < 0) return null;
  errors[index] = {
    ...errors[index],
    aiAnalysis: sanitizeMetadata({
      ...analysis,
      generatedAt: analysis.generatedAt || new Date().toISOString(),
    }),
    updatedAt: new Date().toISOString(),
  };
  writeErrors(errors);
  return errors[index];
}

export function errorFromExpress(err, req, overrides = {}) {
  const status = Number(err.status || err.statusCode) || 500;
  return createError({
    source: overrides.source || 'backend',
    severity: overrides.severity,
    module: overrides.module || req?.baseUrl || req?.path || 'express',
    endpoint: req ? `${req.method} ${req.originalUrl || req.url}` : '',
    httpStatus: status,
    errorCode: err.code || err.name,
    message: err.message || 'Unhandled server error',
    stackTrace: err.stack,
    userFacingMessage: status >= 500 ? 'A server error occurred.' : err.message,
    requestId: req?.id || req?.headers?.['x-request-id'] || '',
    rawMetadata: {
      params: req?.params,
      query: req?.query,
      body: req?.body,
      ...overrides.rawMetadata,
    },
    suggestedFix: overrides.suggestedFix,
    likelyCause: overrides.likelyCause,
  });
}
