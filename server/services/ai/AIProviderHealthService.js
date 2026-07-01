const ANTHROPIC_ENV = 'ANTHROPIC_API_KEY';
const OPENAI_ENV = 'OPENAI_API_KEY';

function isConfigured(envName) {
  return typeof process.env[envName] === 'string' && process.env[envName].trim() !== '';
}

function providerHealth({ requiredEnv }) {
  return {
    configured: isConfigured(requiredEnv),
    requiredEnv,
    exposedSecret: false,
  };
}

function capabilityHealth({ provider, requiredEnv, usedBy, models = [] }) {
  return {
    configured: isConfigured(requiredEnv),
    provider,
    requiredEnv,
    usedBy,
    models,
  };
}

function overallStatus(capabilities) {
  const entries = Object.values(capabilities);
  const configuredCount = entries.filter((capability) => capability.configured).length;
  if (configuredCount === entries.length) return 'healthy';
  if (configuredCount > 0) return 'degraded';
  return 'unconfigured';
}

export function getAIProviderHealth() {
  const providers = {
    anthropic: providerHealth({ requiredEnv: ANTHROPIC_ENV }),
    openai: providerHealth({ requiredEnv: OPENAI_ENV }),
  };

  const capabilities = {
    chatGeneration: capabilityHealth({
      provider: 'anthropic',
      requiredEnv: ANTHROPIC_ENV,
      usedBy: [
        'Assist Reply',
        'Draft Reply',
        'Sales Coach',
        'Objection Assistant',
      ],
      models: ['claude-haiku-4-5-20251001'],
    }),
    visionOcr: capabilityHealth({
      provider: 'anthropic',
      requiredEnv: ANTHROPIC_ENV,
      usedBy: [
        'Knowledge Base image OCR',
        'Knowledge Base scanned PDF OCR',
      ],
      models: ['claude-haiku-4-5-20251001'],
    }),
    errorAnalysis: capabilityHealth({
      provider: 'anthropic',
      requiredEnv: ANTHROPIC_ENV,
      usedBy: ['Error Center AI analysis'],
      models: ['claude-haiku-4-5-20251001'],
    }),
    knowledgeBaseIngestion: capabilityHealth({
      provider: 'anthropic',
      requiredEnv: ANTHROPIC_ENV,
      usedBy: ['Knowledge Base summary/tagging'],
      models: ['claude-haiku-4-5-20251001'],
    }),
    knowledgeBaseExtractionOcr: capabilityHealth({
      provider: 'anthropic',
      requiredEnv: ANTHROPIC_ENV,
      usedBy: ['Knowledge Base OCR / vision extraction'],
      models: ['claude-haiku-4-5-20251001'],
    }),
    transcription: capabilityHealth({
      provider: 'openai',
      requiredEnv: OPENAI_ENV,
      usedBy: ['Knowledge Base audio transcription', 'Knowledge Base video transcription'],
      models: ['whisper-1'],
    }),
    embeddings: capabilityHealth({
      provider: 'openai',
      requiredEnv: OPENAI_ENV,
      usedBy: ['Knowledge Base semantic retrieval', 'Objection knowledge retrieval'],
      models: ['text-embedding-3-small'],
    }),
  };

  return {
    status: overallStatus(capabilities),
    generatedAt: new Date().toISOString(),
    providers,
    capabilities,
  };
}

export default {
  getAIProviderHealth,
};
