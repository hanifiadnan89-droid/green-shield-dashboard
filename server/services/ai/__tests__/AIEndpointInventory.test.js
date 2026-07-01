import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  AI_ENDPOINT_CATEGORIES,
  AI_ENDPOINT_INVENTORY,
  AI_ENDPOINT_STATUSES,
  listCompatibilityAIEndpoints,
  listDeprecatedAIEndpoints,
  listGenerationEndpoints,
  listSoftDeprecatedAIEndpoints,
} from '../AIEndpointInventory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const repoDir = path.resolve(rootDir, '..');

function routeLiteralForPath(pathname) {
  return pathname
    .replace('/api/ai', '')
    .replace('/:id', '/:id');
}

describe('AIEndpointInventory', () => {
  it('documents the final AI endpoint surface count by category', () => {
    expect(AI_ENDPOINT_INVENTORY).toHaveLength(16);
    expect(listGenerationEndpoints()).toHaveLength(6);
    expect(AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.category === AI_ENDPOINT_CATEGORIES.HEALTH)).toHaveLength(3);
    expect(AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.category === AI_ENDPOINT_CATEGORIES.FEEDBACK)).toHaveLength(2);
    expect(AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.category === AI_ENDPOINT_CATEGORIES.SESSION)).toHaveLength(1);
    expect(AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.category === AI_ENDPOINT_CATEGORIES.TRAINING)).toHaveLength(4);
  });

  it('accounts for every /api/ai route registered in server/routes/ai.js', () => {
    const routeSource = fs.readFileSync(path.join(rootDir, 'routes/ai.js'), 'utf8');
    const routeRegex = /router\.(get|post|put|delete|patch)\('([^']+)'/g;
    const actualRoutes = [];
    let match;
    while ((match = routeRegex.exec(routeSource)) !== null) {
      actualRoutes.push({
        method: match[1].toUpperCase(),
        path: `/api/ai${match[2]}`,
      });
    }

    const inventoryKeys = new Set(AI_ENDPOINT_INVENTORY.map((endpoint) => `${endpoint.method} ${endpoint.path}`));
    const missing = actualRoutes
      .map((route) => `${route.method} ${route.path}`)
      .filter((key) => !inventoryKeys.has(key));

    expect(missing).toEqual([]);
  });

  it('maps every inventoried endpoint back to a real route literal', () => {
    const routeSource = fs.readFileSync(path.join(rootDir, 'routes/ai.js'), 'utf8');

    for (const endpoint of AI_ENDPOINT_INVENTORY) {
      const routeLiteral = routeLiteralForPath(endpoint.path);
      expect(routeSource).toContain(`router.${endpoint.method.toLowerCase()}('${routeLiteral}'`);
    }
  });

  it('documents migrated generation endpoints as using the shared AI architecture', () => {
    const generationEndpoints = listGenerationEndpoints();

    expect(generationEndpoints.map((endpoint) => endpoint.path).sort()).toEqual([
      '/api/ai/assist-reply',
      '/api/ai/coach-objection',
      '/api/ai/draft-reply',
      '/api/ai/objection-assist',
      '/api/ai/sales-coach',
      '/api/ai/sales-coach/module',
    ].sort());

    for (const endpoint of generationEndpoints) {
      expect(endpoint.usesAIContextBuilder).toBe(true);
      expect(endpoint.usesPromptAdapter).toBe(true);
      expect(endpoint.usesAIExecutionEngine).toBe(true);
    }
  });

  it('documents non-generation endpoints as feedback, session, training, or health only', () => {
    const nonGeneration = AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.category !== AI_ENDPOINT_CATEGORIES.GENERATION);

    expect(nonGeneration.length).toBeGreaterThan(0);
    for (const endpoint of nonGeneration) {
      expect([
        AI_ENDPOINT_CATEGORIES.FEEDBACK,
        AI_ENDPOINT_CATEGORIES.SESSION,
        AI_ENDPOINT_CATEGORIES.TRAINING,
        AI_ENDPOINT_CATEGORIES.HEALTH,
      ]).toContain(endpoint.category);
      expect(endpoint.usesAIExecutionEngine).toBe(false);
    }
  });

  it('documents admin-only observability endpoints explicitly', () => {
    const adminOnlyPaths = ['/api/ai/health', '/api/ai/usage', '/api/ai/usage/storage'];
    for (const pathname of adminOnlyPaths) {
      const endpoint = AI_ENDPOINT_INVENTORY.find((candidate) => candidate.path === pathname);
      expect(endpoint).toBeTruthy();
      expect(endpoint.category).toBe(AI_ENDPOINT_CATEGORIES.HEALTH);
      expect(endpoint.notes).toContain('Admin-only');
      expect(endpoint.notes).toContain('Gated by requireAdmin');
    }

    const routeSource = fs.readFileSync(path.join(rootDir, 'routes/ai.js'), 'utf8');
    expect(routeSource).toContain("router.get('/health', requireAdmin");
    expect(routeSource).toContain("router.get('/usage/storage', requireAdmin");
    expect(routeSource).toContain("router.get('/usage', requireAdmin");
  });

  it('keeps deprecated public endpoints explicitly documented', () => {
    expect(listDeprecatedAIEndpoints()).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/api/ai/draft-reply',
        status: AI_ENDPOINT_STATUSES.DEPRECATED,
      }),
    ]);
  });

  it('keeps compatibility endpoints explicitly documented', () => {
    expect(listCompatibilityAIEndpoints()).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/api/ai/coach-objection',
        status: AI_ENDPOINT_STATUSES.COMPATIBILITY,
      }),
    ]);
  });

  it('every deprecated/compatibility endpoint declares replacement metadata and a removal checklist', () => {
    const softDeprecated = listSoftDeprecatedAIEndpoints();
    expect(softDeprecated.length).toBeGreaterThan(0);
    for (const endpoint of softDeprecated) {
      expect(typeof endpoint.replacementPath).toBe('string');
      expect(endpoint.replacementPath.startsWith('/api/ai/')).toBe(true);
      expect(endpoint.replacementPath).not.toBe(endpoint.path);
      expect(typeof endpoint.deprecatedSince).toBe('string');
      expect(endpoint.deprecatedSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof endpoint.deprecationReason).toBe('string');
      expect(endpoint.deprecationReason.length).toBeGreaterThan(0);
      expect(endpoint.sunsetTarget).toBeNull();
      expect(Array.isArray(endpoint.removalChecklist)).toBe(true);
      expect(endpoint.removalChecklist.length).toBeGreaterThan(0);
      expect(endpoint.removalChecklist.join('\n')).toContain('/api/ai/usage');
      expect(endpoint.removalChecklist.join('\n')).toContain(endpoint.path);
      // sunsetTarget may be null (no removal date committed yet) or an ISO date string.
      if (endpoint.sunsetTarget !== null && endpoint.sunsetTarget !== undefined) {
        expect(typeof endpoint.sunsetTarget).toBe('string');
        expect(endpoint.sunsetTarget).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('soft-deprecation replacement paths point to existing active endpoints in the inventory', () => {
    const activePaths = new Set(
      AI_ENDPOINT_INVENTORY
        .filter((endpoint) => endpoint.status === AI_ENDPOINT_STATUSES.ACTIVE)
        .map((endpoint) => endpoint.path),
    );
    for (const endpoint of listSoftDeprecatedAIEndpoints()) {
      expect(activePaths.has(endpoint.replacementPath)).toBe(true);
    }
  });

  it('active endpoints do not claim deprecation metadata', () => {
    const active = AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.status === AI_ENDPOINT_STATUSES.ACTIVE);
    expect(active.length).toBeGreaterThan(0);
    for (const endpoint of active) {
      expect(endpoint.replacementPath).toBeUndefined();
      expect(endpoint.deprecatedSince).toBeUndefined();
      expect(endpoint.sunsetTarget).toBeUndefined();
      expect(endpoint.deprecationReason).toBeUndefined();
      expect(endpoint.removalChecklist).toBeUndefined();
    }
  });

  it('inventory has no stale paths — every documented path corresponds to a real route literal', () => {
    const routeSource = fs.readFileSync(path.join(rootDir, 'routes/ai.js'), 'utf8');
    const routeRegex = /router\.(get|post|put|delete|patch)\('([^']+)'/g;
    const realPaths = new Set();
    let match;
    while ((match = routeRegex.exec(routeSource)) !== null) {
      realPaths.add(`/api/ai${match[2]}`);
    }
    for (const endpoint of AI_ENDPOINT_INVENTORY) {
      expect(realPaths.has(endpoint.path)).toBe(true);
    }
  });

  it('keeps the closeout documentation aligned with current inventory paths', () => {
    const docSource = fs.readFileSync(path.join(repoDir, 'docs/ai-migration-architecture.md'), 'utf8');
    for (const endpoint of AI_ENDPOINT_INVENTORY) {
      expect(docSource).toContain(endpoint.path);
    }
    expect(docSource).toContain('server/services/ai/execution/AIExecutionEngine.js');
    expect(docSource).toContain('server/services/ai/embeddings/embeddingProvider.js');
    expect(docSource).toContain('server/services/ai/extraction/transcriptionProvider.js');
    expect(docSource).toContain('prompts');
    expect(docSource).toContain('raw provider responses');
    expect(docSource).toContain('zero `deprecatedRoute` hits');
  });
});
