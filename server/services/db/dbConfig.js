const DEFAULT_POOL_MAX = 5;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5000;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSsl(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || ['false', '0', 'off', 'disable', 'disabled'].includes(normalized)) {
    return false;
  }
  if (['no-verify', 'allow-unauthorized'].includes(normalized)) {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

export function redactDatabaseUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '[invalid-database-url-redacted]';
  }
}

export function getDatabaseConfig(env = process.env) {
  const databaseUrl = normalizeText(env.DATABASE_URL);
  const poolMax = parsePositiveInteger(env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX);
  const connectionTimeoutMillis = parsePositiveInteger(
    env.DATABASE_CONNECTION_TIMEOUT_MS,
    DEFAULT_CONNECTION_TIMEOUT_MS,
  );

  return {
    configured: Boolean(databaseUrl),
    databaseUrl,
    redactedDatabaseUrl: redactDatabaseUrl(databaseUrl),
    ssl: parseSsl(env.DATABASE_SSL),
    poolMax,
    connectionTimeoutMillis,
  };
}

export function getSafeDatabaseConfig(env = process.env) {
  const config = getDatabaseConfig(env);
  return {
    configured: config.configured,
    redactedDatabaseUrl: config.redactedDatabaseUrl,
    sslEnabled: Boolean(config.ssl),
    sslRejectUnauthorized: config.ssl ? config.ssl.rejectUnauthorized !== false : null,
    poolMax: config.poolMax,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
  };
}

