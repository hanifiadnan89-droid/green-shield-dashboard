import { describe, expect, it, vi } from 'vitest';
import { getDatabaseHealth } from '../db/dbHealth.js';

describe('dbHealth', () => {
  it('returns disabled when DATABASE_URL is missing', async () => {
    const query = vi.fn();
    const health = await getDatabaseHealth({ env: {}, query });

    expect(health.status).toBe('disabled');
    expect(health.configured).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns healthy after a lightweight connectivity query', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] });
    const health = await getDatabaseHealth({
      env: { DATABASE_URL: 'postgres://user:secret@example.com/app' },
      query,
    });

    expect(health.status).toBe('healthy');
    expect(query).toHaveBeenCalledWith('select 1 as ok', [], expect.any(Object));
    expect(JSON.stringify(health)).not.toContain('secret');
  });

  it('returns sanitized unhealthy status on failure', async () => {
    const err = new Error('connect failed for postgres://user:secret@example.com/app');
    err.code = 'ECONNREFUSED';
    const query = vi.fn().mockRejectedValue(err);
    const health = await getDatabaseHealth({
      env: { DATABASE_URL: 'postgres://user:secret@example.com/app' },
      query,
    });

    expect(health.status).toBe('unhealthy');
    expect(health.errorCode).toBe('ECONNREFUSED');
    expect(health.message).toBe('Database connectivity check failed.');
    expect(JSON.stringify(health)).not.toContain('secret');
  });
});

