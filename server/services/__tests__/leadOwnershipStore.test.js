import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLeadOwnershipStore, getLeadOwnershipBackend, getLeadOwnershipFilePath } from '../leadOwnershipStore.js';

describe('leadOwnershipStore', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      LEAD_OWNERSHIP_BACKEND: process.env.LEAD_OWNERSHIP_BACKEND,
      LEAD_OWNERSHIP_FILE: process.env.LEAD_OWNERSHIP_FILE,
    };
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults to the file backend and preserves the configured file path', () => {
    process.env.LEAD_OWNERSHIP_BACKEND = '';
    process.env.LEAD_OWNERSHIP_FILE = '/tmp/gs-lead-ownership.json';

    expect(getLeadOwnershipBackend()).toBe('file');
    expect(getLeadOwnershipFilePath()).toBe('/tmp/gs-lead-ownership.json');
  });

  it('supports a memory backend without changing the ownership API', () => {
    process.env.LEAD_OWNERSHIP_BACKEND = 'memory';

    const store = createLeadOwnershipStore({ backend: 'memory' });
    expect(store.backend).toBe('memory');
    expect(store.filePath).toBeNull();

    const next = store.upsert({
      rowNumber: 12,
      organizationId: 'org_green_shield',
      ownerUserId: 'user_ah',
      createdBy: 'system',
      updatedBy: 'system',
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    });

    expect(next.ownerUserId).toBe('user_ah');
    expect(store.get(12).ownerUserId).toBe('user_ah');
    expect(store.list()).toHaveLength(1);
  });
});
