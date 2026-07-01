import { describe, expect, it } from 'vitest';
import {
  getDatabaseConfig,
  getSafeDatabaseConfig,
  redactDatabaseUrl,
} from '../db/dbConfig.js';

describe('dbConfig', () => {
  it('reports unconfigured when DATABASE_URL is missing', () => {
    const config = getDatabaseConfig({});

    expect(config.configured).toBe(false);
    expect(config.databaseUrl).toBe('');
    expect(config.poolMax).toBe(5);
    expect(config.connectionTimeoutMillis).toBe(5000);
  });

  it('redacts database credentials', () => {
    const redacted = redactDatabaseUrl('postgres://user:secret@example.com:5432/app');

    expect(redacted).toContain('***');
    expect(redacted).not.toContain('secret');
    expect(redacted).not.toContain('user:secret');
  });

  it('returns safe config without exposing DATABASE_URL', () => {
    const safe = getSafeDatabaseConfig({
      DATABASE_URL: 'postgres://user:secret@example.com:5432/app',
      DATABASE_SSL: 'no-verify',
      DATABASE_POOL_MAX: '12',
      DATABASE_CONNECTION_TIMEOUT_MS: '7000',
    });

    expect(safe.configured).toBe(true);
    expect(safe.redactedDatabaseUrl).not.toContain('secret');
    expect(safe.sslEnabled).toBe(true);
    expect(safe.sslRejectUnauthorized).toBe(false);
    expect(safe.poolMax).toBe(12);
    expect(safe.connectionTimeoutMillis).toBe(7000);
    expect(safe).not.toHaveProperty('databaseUrl');
  });
});

