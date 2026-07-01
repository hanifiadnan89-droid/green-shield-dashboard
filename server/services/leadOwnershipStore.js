import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DEFAULT_FILE = path.join(DATA_DIR, 'lead-ownership.json');
const SUPPORTED_BACKENDS = new Set(['file', 'memory']);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRowNumber(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : '';
}

function cloneStore(store) {
  return {
    leads: store?.leads && typeof store.leads === 'object' ? { ...store.leads } : {},
  };
}

function atomicWriteJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn('[leadOwnershipStore] Failed to read store:', err.message);
    return fallback;
  }
}

export function getLeadOwnershipBackend() {
  const requested = normalizeText(process.env.LEAD_OWNERSHIP_BACKEND).toLowerCase();
  if (SUPPORTED_BACKENDS.has(requested)) return requested;
  return 'file';
}

export function getLeadOwnershipFilePath() {
  return normalizeText(process.env.LEAD_OWNERSHIP_FILE) || DEFAULT_FILE;
}

function createFileStore(filePath) {
  function read() {
    const raw = readJsonFile(filePath, null);
    return cloneStore(raw);
  }

  function write(store) {
    atomicWriteJsonFile(filePath, cloneStore(store));
    return cloneStore(store);
  }

  function get(rowNumber) {
    const key = normalizeRowNumber(rowNumber);
    if (!key) return null;
    const store = read();
    return store.leads[key] || null;
  }

  function list() {
    return Object.values(read().leads);
  }

  function upsert(record) {
    const key = normalizeRowNumber(record?.rowNumber);
    if (!key) {
      const err = new Error('Lead row number is required.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    const store = read();
    store.leads[key] = {
      rowNumber: key,
      organizationId: record.organizationId,
      ownerUserId: record.ownerUserId,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      source: record.source || 'store',
    };
    write(store);
    return store.leads[key];
  }

  function remove(rowNumber) {
    const key = normalizeRowNumber(rowNumber);
    if (!key) return null;
    const store = read();
    if (!store.leads[key]) return null;
    delete store.leads[key];
    write(store);
    return true;
  }

  return {
    backend: 'file',
    filePath,
    read,
    write,
    get,
    list,
    upsert,
    remove,
  };
}

function createMemoryStore() {
  let state = { leads: {} };

  function read() {
    return cloneStore(state);
  }

  function write(store) {
    state = cloneStore(store);
    return cloneStore(state);
  }

  function get(rowNumber) {
    const key = normalizeRowNumber(rowNumber);
    if (!key) return null;
    return state.leads[key] || null;
  }

  function list() {
    return Object.values(state.leads);
  }

  function upsert(record) {
    const key = normalizeRowNumber(record?.rowNumber);
    if (!key) {
      const err = new Error('Lead row number is required.');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    state.leads[key] = {
      rowNumber: key,
      organizationId: record.organizationId,
      ownerUserId: record.ownerUserId,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      source: record.source || 'store',
    };
    return state.leads[key];
  }

  function remove(rowNumber) {
    const key = normalizeRowNumber(rowNumber);
    if (!key || !state.leads[key]) return null;
    delete state.leads[key];
    return true;
  }

  return {
    backend: 'memory',
    filePath: null,
    read,
    write,
    get,
    list,
    upsert,
    remove,
  };
}

let cachedStore = null;
let cachedKey = '';

export function createLeadOwnershipStore(options = {}) {
  const backend = normalizeText(options.backend || getLeadOwnershipBackend()).toLowerCase();
  const filePath = normalizeText(options.filePath) || getLeadOwnershipFilePath();
  if (backend === 'memory') return createMemoryStore();
  return createFileStore(filePath);
}

export function getLeadOwnershipStore() {
  const backend = getLeadOwnershipBackend();
  const filePath = backend === 'file' ? getLeadOwnershipFilePath() : '';
  const key = `${backend}:${filePath}`;
  if (!cachedStore || cachedKey !== key) {
    cachedStore = createLeadOwnershipStore({ backend, filePath });
    cachedKey = key;
  }
  return cachedStore;
}
