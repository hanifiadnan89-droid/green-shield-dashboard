import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUS_PATH = path.join(__dirname, '..', '..', 'data', 'fieldroutes-auth-status.json');

describe('fieldRoutesAuth stale status', () => {
  let mod;

  beforeEach(async () => {
    if (fs.existsSync(STATUS_PATH)) fs.unlinkSync(STATUS_PATH);
    mod = await import('../fieldRoutesAuth.js');
    await mod.loadAuthStatus();
  });

  afterEach(() => {
    if (fs.existsSync(STATUS_PATH)) fs.unlinkSync(STATUS_PATH);
    mod.stopAuthKeepalive?.();
  });

  it('isAuthStatusFresh returns true for recent ok', () => {
    mod.setAuthStatus('ok');
    expect(mod.isAuthStatusFresh()).toBe(true);
  });

  it('checkAuthHealth skips network when fresh ok', async () => {
    mod.setAuthStatus('ok');
    const result = await mod.checkAuthHealth({ force: false });
    expect(result).toBe('ok');
  });
});
