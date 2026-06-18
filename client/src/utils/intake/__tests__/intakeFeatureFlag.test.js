import { describe, it, expect, vi, afterEach } from 'vitest';
import { isIntakeEnabled } from '../intakeFeatureFlag.js';

describe('isIntakeEnabled (client)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled by default', () => {
    vi.stubEnv('VITE_INTAKE_ENABLED', '');
    expect(isIntakeEnabled()).toBe(false);
  });

  it('is enabled when flag is true', () => {
    vi.stubEnv('VITE_INTAKE_ENABLED', 'true');
    expect(isIntakeEnabled()).toBe(true);
  });
});
