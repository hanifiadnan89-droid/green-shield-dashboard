import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  assertKnowledgeStorageWritable,
  getKnowledgeStorageStatus,
  initializeKnowledgeStorage,
  readKnowledgeJson,
  writeKnowledgeJson,
} from '../knowledgeStorage.js';

const ORIGINAL_ENV = { ...process.env };

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gs-kb-storage-'));
}

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe('knowledgeStorage', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = makeTempDir();
    resetEnv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    resetEnv();
    vi.restoreAllMocks();
    if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('persists items, chunks, embeddings, and upload directory under configured storage', () => {
    process.env.KNOWLEDGE_STORAGE_BACKEND = 'persistent_disk';
    process.env.KNOWLEDGE_DATA_DIR = tempDir;

    const status = initializeKnowledgeStorage();
    expect(status.dataDir).toBe(tempDir);
    expect(status.uploadsDir).toBe(path.join(tempDir, 'knowledge-uploads'));

    writeKnowledgeJson('items', [{ id: 'kb-test', title: 'Durable item' }]);
    writeKnowledgeJson('chunks', { 'kb-test_chunk_0': { itemId: 'kb-test', index: 0, text: 'chunk' } });
    writeKnowledgeJson('embeddings', { 'kb-test_chunk_0': [0.1, 0.2] });

    expect(readKnowledgeJson('items', [])).toEqual([{ id: 'kb-test', title: 'Durable item' }]);
    expect(readKnowledgeJson('chunks', {})).toHaveProperty('kb-test_chunk_0');
    expect(readKnowledgeJson('embeddings', {})).toEqual({ 'kb-test_chunk_0': [0.1, 0.2] });
  });

  it('refuses Render production writes when durable storage is not configured', () => {
    process.env.RENDER = 'true';
    process.env.NODE_ENV = 'production';
    delete process.env.KNOWLEDGE_STORAGE_BACKEND;
    delete process.env.KNOWLEDGE_DATA_DIR;

    const status = getKnowledgeStorageStatus();
    expect(status.writeSafe).toBe(false);
    expect(() => assertKnowledgeStorageWritable()).toThrow(/production writes are disabled/i);
  });

  it('refuses Render production writes when persistent disk env vars are not exact', () => {
    process.env.RENDER = 'true';
    process.env.NODE_ENV = 'production';
    process.env.KNOWLEDGE_STORAGE_BACKEND = 'persistent_disk';
    process.env.KNOWLEDGE_DATA_DIR = tempDir;

    const status = getKnowledgeStorageStatus();
    expect(status.writeSafe).toBe(false);
    expect(status.renderConfigValid).toBe(false);
    expect(() => assertKnowledgeStorageWritable()).toThrow('/var/data/knowledge-base');
  });

  it('treats exact Render persistent disk settings as safe in production', () => {
    process.env.RENDER = 'true';
    process.env.NODE_ENV = 'production';
    process.env.KNOWLEDGE_STORAGE_BACKEND = 'persistent_disk';
    process.env.KNOWLEDGE_DATA_DIR = '/var/data/knowledge-base';

    const status = getKnowledgeStorageStatus();
    expect(status.writeSafe).toBe(true);
    expect(status.renderConfigValid).toBe(true);
    expect(assertKnowledgeStorageWritable().dataDir).toBe('/var/data/knowledge-base');
  });

  it('does not create migration backups when configured storage already has target files', () => {
    process.env.KNOWLEDGE_STORAGE_BACKEND = 'persistent_disk';
    process.env.KNOWLEDGE_DATA_DIR = tempDir;

    fs.writeFileSync(path.join(tempDir, 'knowledge-base-items.json'), '[]\n');
    fs.writeFileSync(path.join(tempDir, 'knowledge-base-chunks.json'), '{}\n');
    fs.writeFileSync(path.join(tempDir, 'knowledge-base-embeddings.json'), '{}\n');
    fs.mkdirSync(path.join(tempDir, 'knowledge-uploads'));

    initializeKnowledgeStorage();

    const backups = fs.readdirSync(tempDir).filter((name) => name.startsWith('legacy-backup-'));
    expect(backups).toEqual([]);
  });
});
