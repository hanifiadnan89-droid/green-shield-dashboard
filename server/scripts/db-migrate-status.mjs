import { runMigrationStatus } from '../services/db/migrations.js';

try {
  const status = await runMigrationStatus();
  if (status.length === 0) {
    console.log('No migration files found.');
  } else {
    for (const migration of status) {
      console.log(`${migration.status.padEnd(8)} ${migration.name}`);
    }
  }
} catch (err) {
  if (err?.code === 'DB_UNCONFIGURED') {
    console.error('DATABASE_URL is not configured. Set DATABASE_URL before checking migration status.');
  } else {
    console.error(`Migration status failed: ${err?.message || err}`);
  }
  process.exitCode = 1;
}

