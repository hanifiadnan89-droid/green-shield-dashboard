import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolConstructor = vi.fn(() => ({
  query: vi.fn(),
  end: vi.fn(),
}));

vi.mock('pg', () => ({
  default: {
    Pool: poolConstructor,
  },
}));

describe('dbClient', () => {
  beforeEach(() => {
    vi.resetModules();
    poolConstructor.mockClear();
  });

  it('does not create a pool at import time', async () => {
    await import('../db/dbClient.js');

    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('throws a controlled error when DATABASE_URL is missing', async () => {
    const { getDbPool } = await import('../db/dbClient.js');

    expect(() => getDbPool({})).toThrow('DATABASE_URL is not configured.');
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('creates a pool only when explicitly requested', async () => {
    const { getDbPool } = await import('../db/dbClient.js');

    getDbPool({
      DATABASE_URL: 'postgres://user:secret@example.com:5432/app',
      DATABASE_SSL: 'false',
    });

    expect(poolConstructor).toHaveBeenCalledTimes(1);
    expect(poolConstructor.mock.calls[0][0]).toMatchObject({
      connectionString: 'postgres://user:secret@example.com:5432/app',
      ssl: false,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  });
});

