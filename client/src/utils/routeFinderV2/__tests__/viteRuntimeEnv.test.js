import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  readViteEnv,
  isViteDevRuntime,
  isViteProdRuntime,
  isViteEnvFlagEnabled,
} from '../viteRuntimeEnv.js';

describe('viteRuntimeEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads VITE flags from process.env when import.meta.env is unavailable in Node', () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', 'true');
    expect(readViteEnv('VITE_ROUTE_FINDER_V2_SCORING')).toBe('true');
    expect(isViteEnvFlagEnabled('VITE_ROUTE_FINDER_V2_SCORING')).toBe(true);
  });

  it('does not throw when checking dev/prod runtime flags', () => {
    expect(() => isViteDevRuntime()).not.toThrow();
    expect(() => isViteProdRuntime()).not.toThrow();
    expect(typeof isViteDevRuntime()).toBe('boolean');
    expect(typeof isViteProdRuntime()).toBe('boolean');
  });

  it('treats unset VITE flags as disabled', () => {
    vi.stubEnv('VITE_ROUTE_FINDER_V2_SCORING', '');
    expect(isViteEnvFlagEnabled('VITE_ROUTE_FINDER_V2_SCORING')).toBe(false);
  });
});
