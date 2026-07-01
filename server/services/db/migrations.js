import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withDbClient } from './dbClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '../..');
const DEFAULT_MIGRATIONS_DIR = path.join(SERVER_DIR, 'migrations');
const UNDEFINED_TABLE = '42P01';

export function getDefaultMigrationsDir() {
  return DEFAULT_MIGRATIONS_DIR;
}

export function calculateChecksum(sql) {
  return crypto.createHash('sha256').update(String(sql || ''), 'utf8').digest('hex');
}

export function listMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const filePath = path.join(migrationsDir, name);
      const sql = fs.readFileSync(filePath, 'utf8');
      return {
        name,
        path: filePath,
        checksum: calculateChecksum(sql),
        sql,
      };
    });
}

export async function getAppliedMigrations(client) {
  try {
    const result = await client.query(
      'select name, checksum, applied_at from schema_migrations order by name asc',
    );
    return result.rows || [];
  } catch (err) {
    if (err?.code === UNDEFINED_TABLE) return [];
    throw err;
  }
}

function assertNoChecksumMismatch(files, applied) {
  const appliedByName = new Map(applied.map((migration) => [migration.name, migration]));
  for (const file of files) {
    const record = appliedByName.get(file.name);
    if (record && record.checksum !== file.checksum) {
      const err = new Error(`Migration checksum mismatch: ${file.name}`);
      err.code = 'MIGRATION_CHECKSUM_MISMATCH';
      err.migration = file.name;
      throw err;
    }
  }
}

export async function getMigrationStatus(client, options = {}) {
  const files = listMigrationFiles(options.migrationsDir);
  const applied = await getAppliedMigrations(client);
  assertNoChecksumMismatch(files, applied);
  const appliedByName = new Map(applied.map((migration) => [migration.name, migration]));

  return files.map((file) => {
    const record = appliedByName.get(file.name);
    return {
      name: file.name,
      checksum: file.checksum,
      status: record ? 'applied' : 'pending',
      appliedAt: record?.applied_at || null,
    };
  });
}

async function applyMigration(client, migration) {
  await client.query('begin');
  try {
    await client.query(migration.sql);
    await client.query(
      `insert into schema_migrations (name, checksum)
       values ($1, $2)
       on conflict (name)
       do update set checksum = excluded.checksum, applied_at = now()`,
      [migration.name, migration.checksum],
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

export async function applyPendingMigrations(client, options = {}) {
  const files = listMigrationFiles(options.migrationsDir);
  const applied = await getAppliedMigrations(client);
  assertNoChecksumMismatch(files, applied);
  const appliedNames = new Set(applied.map((migration) => migration.name));
  const pending = files.filter((file) => !appliedNames.has(file.name));

  if (options.dryRun) {
    return {
      applied: [],
      pending: pending.map((migration) => migration.name),
      dryRun: true,
    };
  }

  const appliedNow = [];
  for (const migration of pending) {
    await applyMigration(client, migration);
    appliedNow.push(migration.name);
  }
  return {
    applied: appliedNow,
    pending: [],
    dryRun: false,
  };
}

export async function runMigrationStatus(options = {}) {
  return withDbClient((client) => getMigrationStatus(client, options), options);
}

export async function runPendingMigrations(options = {}) {
  return withDbClient((client) => applyPendingMigrations(client, options), options);
}

