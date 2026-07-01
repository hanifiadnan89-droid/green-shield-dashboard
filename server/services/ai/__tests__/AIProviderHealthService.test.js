import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import { getAIProviderHealth } from '../AIProviderHealthService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORIGINAL_ENV = { ...process.env };

function setProviderEnv({ anthropic = null, openai = null } = {}) {
  process.env = { ...ORIGINAL_ENV };
  if (anthropic == null) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = anthropic;

  if (openai == null) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = openai;
}

function stringify(value) {
  return JSON.stringify(value);
}

describe('AIProviderHealthService', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('reports healthy when Anthropic and OpenAI keys are configured', () => {
    setProviderEnv({ anthropic: 'anthropic-secret-value', openai: 'openai-secret-value' });

    const health = getAIProviderHealth();

    expect(health.status).toBe('healthy');
    expect(health.generatedAt).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(health.generatedAt))).toBe(false);
    expect(health.providers.anthropic).toEqual({
      configured: true,
      requiredEnv: 'ANTHROPIC_API_KEY',
      exposedSecret: false,
    });
    expect(health.providers.openai).toEqual({
      configured: true,
      requiredEnv: 'OPENAI_API_KEY',
      exposedSecret: false,
    });
    expect(health.capabilities.chatGeneration.configured).toBe(true);
    expect(health.capabilities.visionOcr.configured).toBe(true);
    expect(health.capabilities.errorAnalysis.configured).toBe(true);
    expect(health.capabilities.knowledgeBaseIngestion.configured).toBe(true);
    expect(health.capabilities.knowledgeBaseExtractionOcr.configured).toBe(true);
    expect(health.capabilities.transcription.configured).toBe(true);
    expect(health.capabilities.embeddings.configured).toBe(true);
  });

  it('reports degraded when only one provider key is configured', () => {
    setProviderEnv({ anthropic: 'anthropic-secret-value', openai: null });

    const anthropicOnly = getAIProviderHealth();

    expect(anthropicOnly.status).toBe('degraded');
    expect(anthropicOnly.capabilities.chatGeneration.configured).toBe(true);
    expect(anthropicOnly.capabilities.transcription.configured).toBe(false);
    expect(anthropicOnly.capabilities.embeddings.configured).toBe(false);

    setProviderEnv({ anthropic: null, openai: 'openai-secret-value' });

    const openaiOnly = getAIProviderHealth();

    expect(openaiOnly.status).toBe('degraded');
    expect(openaiOnly.capabilities.chatGeneration.configured).toBe(false);
    expect(openaiOnly.capabilities.visionOcr.configured).toBe(false);
    expect(openaiOnly.capabilities.transcription.configured).toBe(true);
    expect(openaiOnly.capabilities.embeddings.configured).toBe(true);
  });

  it('reports unconfigured when no provider keys are configured', () => {
    setProviderEnv({ anthropic: null, openai: null });

    const health = getAIProviderHealth();

    expect(health.status).toBe('unconfigured');
    expect(Object.values(health.providers).every((provider) => provider.configured === false)).toBe(true);
    expect(Object.values(health.capabilities).every((capability) => capability.configured === false)).toBe(true);
  });

  it('maps capabilities to the correct providers, env vars, and model names', () => {
    setProviderEnv({ anthropic: 'anthropic-secret-value', openai: 'openai-secret-value' });

    const { capabilities } = getAIProviderHealth();

    for (const key of [
      'chatGeneration',
      'visionOcr',
      'errorAnalysis',
      'knowledgeBaseIngestion',
      'knowledgeBaseExtractionOcr',
    ]) {
      expect(capabilities[key].provider).toBe('anthropic');
      expect(capabilities[key].requiredEnv).toBe('ANTHROPIC_API_KEY');
      expect(capabilities[key].models).toContain('claude-haiku-4-5-20251001');
    }

    expect(capabilities.transcription.provider).toBe('openai');
    expect(capabilities.transcription.requiredEnv).toBe('OPENAI_API_KEY');
    expect(capabilities.transcription.models).toEqual(['whisper-1']);
    expect(capabilities.embeddings.provider).toBe('openai');
    expect(capabilities.embeddings.requiredEnv).toBe('OPENAI_API_KEY');
    expect(capabilities.embeddings.models).toEqual(['text-embedding-3-small']);
  });

  it('never exposes secret values', () => {
    setProviderEnv({ anthropic: 'anthropic-secret-value', openai: 'openai-secret-value' });

    const serialized = stringify(getAIProviderHealth());

    expect(serialized).not.toContain('anthropic-secret-value');
    expect(serialized).not.toContain('openai-secret-value');
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
  });

  it('does not import provider SDKs or initialize provider clients', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'AIProviderHealthService.js'), 'utf8');

    expect(source).not.toContain('@anthropic-ai/sdk');
    expect(source).not.toContain("from 'openai'");
    expect(source).not.toContain('new OpenAI');
    expect(source).not.toContain('new Anthropic');
    expect(source).not.toContain('messages.create');
    expect(source).not.toContain('embeddings.create');
    expect(source).not.toContain('audio.transcriptions.create');
  });
});
