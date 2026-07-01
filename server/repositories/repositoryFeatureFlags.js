function parseBooleanFlag(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'on', 'yes'].includes(normalized);
}

export function getRepositoryFeatureFlags(env = process.env) {
  return {
    dbWriteAIUsageEnabled: parseBooleanFlag(env.DB_WRITE_AI_USAGE_ENABLED),
    dbReadAIUsageEnabled: parseBooleanFlag(env.DB_READ_AI_USAGE_ENABLED),
    dbWriteErrorLogEnabled: parseBooleanFlag(env.DB_WRITE_ERROR_LOG_ENABLED),
    dbReadErrorLogEnabled: parseBooleanFlag(env.DB_READ_ERROR_LOG_ENABLED),
  };
}

export { parseBooleanFlag };

