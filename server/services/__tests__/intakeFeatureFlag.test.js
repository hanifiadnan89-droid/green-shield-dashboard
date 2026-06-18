import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isIntakeEnabled } from '../intakeFeatureFlag.js';

describe('isIntakeEnabled', () => {
  const original = process.env.INTAKE_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.INTAKE_ENABLED;
    else process.env.INTAKE_ENABLED = original;
  });

  it('defaults to enabled when unset', () => {
    delete process.env.INTAKE_ENABLED;
    expect(isIntakeEnabled()).toBe(true);
  });

  it('respects false values', () => {
    process.env.INTAKE_ENABLED = 'false';
    expect(isIntakeEnabled()).toBe(false);
  });
});
