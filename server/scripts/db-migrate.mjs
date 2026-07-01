import { runPendingMigrations } from '../services/db/migrations.js';

try {
  const result = await runPendingMigrations();
  if (result.applied.length === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`Applied migrations: ${result.applied.join(', ')}`);
  }
} catch (err) {
  if (err?.code === 'DB_UNCONFIGURED') {
    console.error('DATABASE_URL is not configured. Set DATABASE_URL before running migrations.');
  } else {
    console.error(`Migration failed: ${err?.message || err}`);
  }
  process.exitCode = 1;
}

