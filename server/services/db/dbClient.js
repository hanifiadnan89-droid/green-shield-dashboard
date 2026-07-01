import pg from 'pg';
import { getDatabaseConfig } from './dbConfig.js';

const { Pool } = pg;

let pool = null;
let poolConfigKey = null;

function buildPoolConfig(config) {
  return {
    connectionString: config.databaseUrl,
    ssl: config.ssl,
    max: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  };
}

function configKey(config) {
  return JSON.stringify({
    databaseUrl: config.databaseUrl,
    ssl: config.ssl,
    poolMax: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  });
}

export function getDbPool(env = process.env) {
  const config = getDatabaseConfig(env);
  if (!config.configured) {
    const err = new Error('DATABASE_URL is not configured.');
    err.code = 'DB_UNCONFIGURED';
    throw err;
  }

  const nextKey = configKey(config);
  if (!pool || poolConfigKey !== nextKey) {
    pool = new Pool(buildPoolConfig(config));
    poolConfigKey = nextKey;
  }
  return pool;
}

export async function query(text, params = [], options = {}) {
  const dbPool = options.pool || getDbPool(options.env || process.env);
  return dbPool.query(text, params);
}

export async function withDbClient(callback, options = {}) {
  const dbPool = options.pool || getDbPool(options.env || process.env);
  const client = await dbPool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function closeDbPool() {
  if (pool) {
    await pool.end();
    pool = null;
    poolConfigKey = null;
  }
}

export function resetDbPoolForTests() {
  pool = null;
  poolConfigKey = null;
}
