import { getDatabaseConfig, getSafeDatabaseConfig } from './dbConfig.js';
import { query as defaultQuery } from './dbClient.js';

function safeDurationMs(startedAt) {
  return Math.max(0, Date.now() - startedAt);
}

export async function getDatabaseHealth(options = {}) {
  const env = options.env || process.env;
  const config = getDatabaseConfig(env);
  const startedAt = Date.now();

  if (!config.configured) {
    return {
      status: 'disabled',
      configured: false,
      checkedAt: new Date().toISOString(),
      durationMs: 0,
      config: getSafeDatabaseConfig(env),
    };
  }

  try {
    const queryFn = options.query || defaultQuery;
    await queryFn('select 1 as ok', [], { env });
    return {
      status: 'healthy',
      configured: true,
      checkedAt: new Date().toISOString(),
      durationMs: safeDurationMs(startedAt),
      config: getSafeDatabaseConfig(env),
    };
  } catch (err) {
    return {
      status: 'unhealthy',
      configured: true,
      checkedAt: new Date().toISOString(),
      durationMs: safeDurationMs(startedAt),
      errorCode: err?.code || 'DB_HEALTH_CHECK_FAILED',
      message: 'Database connectivity check failed.',
      config: getSafeDatabaseConfig(env),
    };
  }
}

