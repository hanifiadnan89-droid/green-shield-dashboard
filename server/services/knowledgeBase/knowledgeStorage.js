import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const DEFAULT_DATA_DIR = path.join(SERVER_DIR, 'data');
const LEGACY_DATA_DIR = DEFAULT_DATA_DIR;
const JSON_FILE_NAMES = {
  items: 'knowledge-base-items.json',
  chunks: 'knowledge-base-chunks.json',
  embeddings: 'knowledge-base-embeddings.json',
};
const UPLOADS_DIR_NAME = 'knowledge-uploads';
const REQUIRED_RENDER_BACKEND = 'persistent_disk';
const REQUIRED_RENDER_DATA_DIR = '/var/data/knowledge-base';

let startupLogged = false;

function normalizeBackend(value) {
  const backend = String(value || 'file').trim().toLowerCase();
  if (['file', 'persistent_disk', 'postgres'].includes(backend)) return backend;
  return 'file';
}

function getConfiguredDataDir() {
  const configured = process.env.KNOWLEDGE_DATA_DIR;
  const dataDir = configured && configured.trim()
    ? path.resolve(configured.trim())
    : DEFAULT_DATA_DIR;
  return { dataDir, configured: Boolean(configured && configured.trim()) };
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function atomicWriteJsonFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function copyFileIfTargetMissing(source, target) {
  if (!fs.existsSync(source) || fs.existsSync(target)) return false;
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
  return true;
}

function copyDirectoryContentsIfTargetMissing(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir) || fs.existsSync(targetDir)) return false;
  ensureDir(path.dirname(targetDir));
  fs.cpSync(sourceDir, targetDir, { recursive: true, errorOnExist: false });
  return true;
}

function migrateLegacyKnowledgeData(status) {
  if (!status.dataDirConfigured || status.dataDir === LEGACY_DATA_DIR) return [];

  ensureDir(status.dataDir);
  const legacyFiles = [
    ...Object.values(JSON_FILE_NAMES).map((name) => ({
      source: path.join(LEGACY_DATA_DIR, name),
      target: path.join(status.dataDir, name),
      label: name,
    })),
    {
      source: path.join(LEGACY_DATA_DIR, UPLOADS_DIR_NAME),
      target: path.join(status.dataDir, UPLOADS_DIR_NAME),
      label: UPLOADS_DIR_NAME,
      directory: true,
    },
  ];

  const pending = legacyFiles.filter(({ source, target }) => fs.existsSync(source) && !fs.existsSync(target));
  if (!pending.length) return [];

  const backupRoot = path.join(
    status.dataDir,
    `legacy-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`,
  );
  ensureDir(backupRoot);

  const migrated = [];
  for (const entry of pending) {
    const backupTarget = path.join(backupRoot, entry.label);
    if (entry.directory) {
      fs.cpSync(entry.source, backupTarget, { recursive: true, errorOnExist: false });
      if (copyDirectoryContentsIfTargetMissing(entry.source, entry.target)) migrated.push(entry.label);
    } else {
      fs.copyFileSync(entry.source, backupTarget);
      if (copyFileIfTargetMissing(entry.source, entry.target)) migrated.push(entry.label);
    }
  }

  if (migrated.length) {
    console.log(`[knowledgeStorage] Migrated legacy Knowledge Base data to ${status.dataDir}: ${migrated.join(', ')}`);
    console.log(`[knowledgeStorage] Legacy backup written to ${backupRoot}. Old files were not deleted.`);
  }

  return migrated;
}

export function getKnowledgeStorageStatus() {
  const backend = normalizeBackend(process.env.KNOWLEDGE_STORAGE_BACKEND);
  const { dataDir, configured } = getConfiguredDataDir();
  const render = Boolean(process.env.RENDER);
  const production = process.env.NODE_ENV === 'production';
  const inRepo = isPathInside(dataDir, SERVER_DIR);
  const expectedRenderDataDir = path.resolve(REQUIRED_RENDER_DATA_DIR);
  const renderConfigValid = backend === REQUIRED_RENDER_BACKEND && configured && dataDir === expectedRenderDataDir;
  const writeSafe = !(render && production && !renderConfigValid);
  const warning = writeSafe
    ? inRepo
      ? 'Knowledge Base is using local development storage inside the application repository. Do not use this for production data on Render.'
      : null
    : render && production
      ? `Knowledge Base production writes are disabled. Configure a Render persistent disk mounted at /var/data and set KNOWLEDGE_STORAGE_BACKEND=${REQUIRED_RENDER_BACKEND} and KNOWLEDGE_DATA_DIR=${REQUIRED_RENDER_DATA_DIR}.`
      : 'Knowledge Base writes are disabled because the configured storage directory is inside the application repository.';

  return {
    backend,
    dataDir,
    uploadsDir: path.join(dataDir, UPLOADS_DIR_NAME),
    dataDirConfigured: configured,
    requiredRenderBackend: REQUIRED_RENDER_BACKEND,
    requiredRenderDataDir: REQUIRED_RENDER_DATA_DIR,
    renderConfigValid,
    render,
    production,
    inRepo,
    writeSafe,
    warning,
  };
}

export function initializeKnowledgeStorage() {
  const status = getKnowledgeStorageStatus();
  if (!status.writeSafe) {
    if (!startupLogged) {
      startupLogged = true;
      console.error(`[knowledgeStorage] ${status.warning}`);
      console.error(`[knowledgeStorage] backend=${status.backend} dataDir=${status.dataDir} uploadsDir=${status.uploadsDir}`);
    }
    return status;
  }

  ensureDir(status.dataDir);
  ensureDir(status.uploadsDir);
  const migrated = migrateLegacyKnowledgeData(status);
  for (const fileName of Object.values(JSON_FILE_NAMES)) {
    const filePath = path.join(status.dataDir, fileName);
    if (!fs.existsSync(filePath)) {
      atomicWriteJsonFile(filePath, fileName.endsWith('items.json') ? [] : {});
    }
  }

  if (!startupLogged) {
    startupLogged = true;
    console.log(`[knowledgeStorage] backend=${status.backend} dataDir=${status.dataDir} uploadsDir=${status.uploadsDir}`);
    if (migrated.length) console.log(`[knowledgeStorage] migration=${migrated.join(',')}`);
    if (status.warning) console.error(`[knowledgeStorage] ${status.warning}`);
  }

  return status;
}

export function assertKnowledgeStorageWritable() {
  const status = getKnowledgeStorageStatus();
  if (!status.writeSafe) {
    const err = new Error(status.warning);
    err.code = 'KNOWLEDGE_STORAGE_UNSAFE';
    err.status = 503;
    throw err;
  }
  return status;
}

export function getKnowledgeFilePath(kind) {
  const fileName = JSON_FILE_NAMES[kind];
  if (!fileName) throw new Error(`Unknown Knowledge Base file kind: ${kind}`);
  return path.join(getConfiguredDataDir().dataDir, fileName);
}

export function getKnowledgeUploadDir() {
  return getKnowledgeStorageStatus().uploadsDir;
}

export function toKnowledgeStorageRelativePath(filePath) {
  if (!filePath) return null;
  const { dataDir } = getConfiguredDataDir();
  const relative = path.relative(dataDir, path.resolve(filePath));
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : path.resolve(filePath);
}

export function fromKnowledgeStorageRelativePath(storedPath) {
  if (!storedPath) return null;
  if (path.isAbsolute(storedPath)) return storedPath;
  return path.join(getConfiguredDataDir().dataDir, storedPath);
}

export function readKnowledgeJson(kind, fallback) {
  initializeKnowledgeStorage();
  return readJsonFile(getKnowledgeFilePath(kind), fallback);
}

export function writeKnowledgeJson(kind, data) {
  assertKnowledgeStorageWritable();
  atomicWriteJsonFile(getKnowledgeFilePath(kind), data);
}
