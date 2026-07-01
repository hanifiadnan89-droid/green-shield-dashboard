import { describe, expect, it } from 'vitest';
import { getRepositoryFeatureFlags, parseBooleanFlag } from '../repositoryFeatureFlags.js';

describe('repository feature flags', () => {
  it('defaults all DB read/write flags to false', () => {
    expect(getRepositoryFeatureFlags({})).toEqual({
      dbWriteAIUsageEnabled: false,
      dbReadAIUsageEnabled: false,
      dbWriteErrorLogEnabled: false,
      dbReadErrorLogEnabled: false,
    });
  });

  it('parses explicit true values', () => {
    for (const value of ['true', '1', 'on', 'yes', 'TRUE', ' Yes ']) {
      expect(parseBooleanFlag(value)).toBe(true);
    }
    for (const value of ['false', '0', 'off', 'no', '', undefined]) {
      expect(parseBooleanFlag(value)).toBe(false);
    }
  });

  it('reads all Stage 30 flags from env-like input', () => {
    expect(getRepositoryFeatureFlags({
      DB_WRITE_AI_USAGE_ENABLED: 'true',
      DB_READ_AI_USAGE_ENABLED: '1',
      DB_WRITE_ERROR_LOG_ENABLED: 'on',
      DB_READ_ERROR_LOG_ENABLED: 'yes',
    })).toEqual({
      dbWriteAIUsageEnabled: true,
      dbReadAIUsageEnabled: true,
      dbWriteErrorLogEnabled: true,
      dbReadErrorLogEnabled: true,
    });
  });
});

