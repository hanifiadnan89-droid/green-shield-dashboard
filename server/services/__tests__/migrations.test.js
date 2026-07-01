import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyPendingMigrations,
  calculateChecksum,
  getAppliedMigrations,
  getMigrationStatus,
  listMigrationFiles,
} from '../db/migrations.js';

let tempDir;

function writeMigration(name, sql) {
  fs.writeFileSync(path.join(tempDir, name), sql, 'utf8');
}

class FakeClient {
  constructor({ applied = [], tableExists = true } = {}) {
    this.applied = [...applied];
    this.tableExists = tableExists;
    this.queries = [];
  }

  async query(sql, params = []) {
    this.queries.push({ sql, params });
    const normalized = String(sql).trim().toLowerCase();

    if (normalized.startsWith('select name, checksum, applied_at from schema_migrations')) {
      if (!this.tableExists) {
        const err = new Error('relation "schema_migrations" does not exist');
        err.code = '42P01';
        throw err;
      }
      return { rows: this.applied };
    }

    if (normalized.startsWith('insert into schema_migrations')) {
      this.tableExists = true;
      this.applied.push({
        name: params[0],
        checksum: params[1],
        applied_at: new Date().toISOString(),
      });
      return { rows: [] };
    }

    if (normalized.includes('create table if not exists schema_migrations')) {
      this.tableExists = true;
    }

    return { rows: [] };
  }
}

describe('migrations', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-db-migrations-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('discovers and sorts migration files', () => {
    writeMigration('002_second.sql', 'select 2;');
    writeMigration('001_first.sql', 'select 1;');
    writeMigration('notes.txt', 'ignore');

    const files = listMigrationFiles(tempDir);

    expect(files.map((file) => file.name)).toEqual(['001_first.sql', '002_second.sql']);
    expect(files[0].checksum).toBe(calculateChecksum('select 1;'));
  });

  it('treats a missing schema_migrations table as no applied migrations', async () => {
    const client = new FakeClient({ tableExists: false });

    await expect(getAppliedMigrations(client)).resolves.toEqual([]);
  });

  it('identifies pending and applied migrations', async () => {
    writeMigration('001_first.sql', 'select 1;');
    writeMigration('002_second.sql', 'select 2;');
    const applied = [{
      name: '001_first.sql',
      checksum: calculateChecksum('select 1;'),
      applied_at: '2026-01-01T00:00:00.000Z',
    }];
    const client = new FakeClient({ applied });

    const status = await getMigrationStatus(client, { migrationsDir: tempDir });

    expect(status.map((item) => [item.name, item.status])).toEqual([
      ['001_first.sql', 'applied'],
      ['002_second.sql', 'pending'],
    ]);
  });

  it('fails safely on checksum mismatch', async () => {
    writeMigration('001_first.sql', 'select changed;');
    const client = new FakeClient({
      applied: [{
        name: '001_first.sql',
        checksum: calculateChecksum('select old;'),
        applied_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    await expect(getMigrationStatus(client, { migrationsDir: tempDir }))
      .rejects.toMatchObject({ code: 'MIGRATION_CHECKSUM_MISMATCH' });
  });

  it('skips already-applied migrations and applies pending migrations in transactions', async () => {
    writeMigration('001_first.sql', 'select 1;');
    writeMigration('002_second.sql', 'select 2;');
    const client = new FakeClient({
      applied: [{
        name: '001_first.sql',
        checksum: calculateChecksum('select 1;'),
        applied_at: '2026-01-01T00:00:00.000Z',
      }],
    });

    const result = await applyPendingMigrations(client, { migrationsDir: tempDir });

    expect(result.applied).toEqual(['002_second.sql']);
    expect(client.queries.map((query) => String(query.sql).trim().toLowerCase()))
      .toEqual(expect.arrayContaining(['begin', 'select 2;', 'commit']));
    expect(client.queries.some((query) => String(query.sql).includes('select 1;'))).toBe(false);
  });

  it('supports dry-run without executing migration SQL', async () => {
    writeMigration('001_first.sql', 'select 1;');
    const client = new FakeClient();

    const result = await applyPendingMigrations(client, { migrationsDir: tempDir, dryRun: true });

    expect(result).toEqual({
      applied: [],
      pending: ['001_first.sql'],
      dryRun: true,
    });
    expect(client.queries.some((query) => String(query.sql).includes('select 1;'))).toBe(false);
  });
});

