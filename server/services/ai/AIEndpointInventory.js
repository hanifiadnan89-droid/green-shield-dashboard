export const AI_ENDPOINT_CATEGORIES = Object.freeze({
  GENERATION: 'generation',
  FEEDBACK: 'feedback',
  TRAINING: 'training',
  SESSION: 'session',
  HEALTH: 'health',
});

export const AI_ENDPOINT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  COMPATIBILITY: 'compatibility',
});

export const AI_ENDPOINT_INVENTORY = Object.freeze([
  {
    method: 'GET',
    path: '/api/ai/health',
    category: AI_ENDPOINT_CATEGORIES.HEALTH,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js -> server/services/ai/AIProviderHealthService.js',
    frontendCallers: [],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Admin-only passive AI provider configuration diagnostics. Does not call providers. Gated by requireAdmin.',
  },
  {
    method: 'GET',
    path: '/api/ai/usage',
    category: AI_ENDPOINT_CATEGORIES.HEALTH,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js -> server/services/ai/AIUsageRecorder.js',
    frontendCallers: [],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Admin-only sanitized AI execution usage log + summary. No prompts or raw responses are stored or returned. Gated by requireAdmin.',
  },
  {
    method: 'GET',
    path: '/api/ai/usage/storage',
    category: AI_ENDPOINT_CATEGORIES.HEALTH,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js -> server/services/ai/AIUsageRecorder.js (getSafeAIUsageLogStorageStatus)',
    frontendCallers: [],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Admin-only AI usage-log storage health. Returns only operational flags (backend, configured, source, render, production, inRepo, writeSafe, warning); never returns filePath, dataDir, or env values. Gated by requireAdmin.',
  },
  {
    method: 'POST',
    path: '/api/ai/assist-reply',
    category: AI_ENDPOINT_CATEGORIES.GENERATION,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/Replies.jsx'],
    usesAIContextBuilder: true,
    usesPromptAdapter: true,
    usesAIExecutionEngine: true,
    notes: 'Interactive Replies copilot. Requires row-scoped reply context.',
  },
  {
    method: 'POST',
    path: '/api/ai/draft-reply',
    category: AI_ENDPOINT_CATEGORIES.GENERATION,
    status: AI_ENDPOINT_STATUSES.DEPRECATED,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/api/client.js compatibility wrapper (no in-app callers as of 2026-06-30)'],
    usesAIContextBuilder: true,
    usesPromptAdapter: true,
    usesAIExecutionEngine: true,
    replacementPath: '/api/ai/assist-reply',
    deprecatedSince: '2026-06-30',
    sunsetTarget: null,
    deprecationReason: 'Superseded by the interactive Assist Reply endpoint; no remaining in-app callers.',
    removalChecklist: [
      'Confirm /api/ai/usage shows zero deprecatedRoute hits for /api/ai/draft-reply for at least 30 days.',
      'Confirm no external caller depends on POST /api/ai/draft-reply.',
      'Remove the /draft-reply route handler from server/routes/ai.js.',
      'Remove the api.ai.draftReply compatibility wrapper from client/src/api/client.js.',
      'Remove deprecated Draft Reply route tests.',
      'Update AIEndpointInventory and inventory tests.',
      'Run the full server suite and client build.',
    ],
    notes: 'Legacy Draft Reply endpoint kept for compatibility; prefer /api/ai/assist-reply. Responds with Deprecation + X-GreenShield-Replacement headers.',
  },
  {
    method: 'POST',
    path: '/api/ai/sales-coach/module',
    category: AI_ENDPOINT_CATEGORIES.GENERATION,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js -> server/services/salesCoachEngine.js',
    frontendCallers: ['client/src/pages/SalesCoach/api/salesCoachApi.js'],
    usesAIContextBuilder: true,
    usesPromptAdapter: true,
    usesAIExecutionEngine: true,
    notes: 'Primary Sales Coach module endpoint.',
  },
  {
    method: 'POST',
    path: '/api/ai/coach-objection',
    category: AI_ENDPOINT_CATEGORIES.GENERATION,
    status: AI_ENDPOINT_STATUSES.COMPATIBILITY,
    backend: 'server/routes/ai.js -> server/services/salesCoachEngine.js',
    frontendCallers: ['client/src/api/client.js compatibility wrapper (no in-app callers as of 2026-06-30)'],
    usesAIContextBuilder: true,
    usesPromptAdapter: true,
    usesAIExecutionEngine: true,
    replacementPath: '/api/ai/sales-coach/module',
    deprecatedSince: '2026-06-30',
    sunsetTarget: null,
    deprecationReason: 'Superseded by /api/ai/sales-coach/module; alias kept for any external callers.',
    removalChecklist: [
      'Confirm /api/ai/usage shows zero deprecatedRoute hits for /api/ai/coach-objection for at least 30 days.',
      'Confirm no external caller depends on POST /api/ai/coach-objection.',
      'Remove the /coach-objection route handler from server/routes/ai.js.',
      'Remove the api.ai.coachObjection compatibility wrapper from client/src/api/client.js if still present.',
      'Remove deprecated Coach Objection route tests.',
      'Update AIEndpointInventory and inventory tests.',
      'Run the full server suite and client build.',
    ],
    notes: 'Compatibility alias for objection coaching. Responds with Deprecation + X-GreenShield-Replacement headers.',
  },
  {
    method: 'POST',
    path: '/api/ai/sales-coach',
    category: AI_ENDPOINT_CATEGORIES.GENERATION,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/Intake/components/ObjectionAssistant.jsx'],
    usesAIContextBuilder: true,
    usesPromptAdapter: true,
    usesAIExecutionEngine: true,
    notes: 'Legacy Intake Sales Coach flow; active frontend caller remains.',
  },
  {
    method: 'POST',
    path: '/api/ai/objection-assist',
    category: AI_ENDPOINT_CATEGORIES.GENERATION,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/Intake/components/ObjectionAssistant.jsx'],
    usesAIContextBuilder: true,
    usesPromptAdapter: true,
    usesAIExecutionEngine: true,
    notes: 'Dedicated Intake Objection Assistant endpoint.',
  },
  {
    method: 'POST',
    path: '/api/ai/objection-feedback',
    category: AI_ENDPOINT_CATEGORIES.FEEDBACK,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: [
      'client/src/pages/Intake/components/ObjectionAssistant.jsx',
      'client/src/pages/SalesCoach/api/salesCoachApi.js',
    ],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Persists human feedback; no model generation.',
  },
  {
    method: 'POST',
    path: '/api/ai/objection-outcome',
    category: AI_ENDPOINT_CATEGORIES.FEEDBACK,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: [
      'client/src/pages/Intake/components/ObjectionAssistant.jsx',
      'client/src/pages/SalesCoach/api/salesCoachApi.js',
    ],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Persists sales outcomes/cases; no model generation.',
  },
  {
    method: 'GET',
    path: '/api/ai/sales-coach/sessions',
    category: AI_ENDPOINT_CATEGORIES.SESSION,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/SalesCoach/modules/TrainingCenter/TrainingCenter.jsx'],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Lists Sales Coach sessions; no model generation.',
  },
  {
    method: 'GET',
    path: '/api/ai/sales-coach/training',
    category: AI_ENDPOINT_CATEGORIES.TRAINING,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/SalesCoach/modules/TrainingCenter/TrainingCenter.jsx'],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Lists Training Center items; no model generation.',
  },
  {
    method: 'POST',
    path: '/api/ai/sales-coach/training',
    category: AI_ENDPOINT_CATEGORIES.TRAINING,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/SalesCoach/modules/TrainingCenter/TrainingCenter.jsx'],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Creates Training Center items; no model generation.',
  },
  {
    method: 'PUT',
    path: '/api/ai/sales-coach/training/:id',
    category: AI_ENDPOINT_CATEGORIES.TRAINING,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/SalesCoach/modules/TrainingCenter/TrainingCenter.jsx'],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Updates Training Center items; no model generation.',
  },
  {
    method: 'DELETE',
    path: '/api/ai/sales-coach/training/:id',
    category: AI_ENDPOINT_CATEGORIES.TRAINING,
    status: AI_ENDPOINT_STATUSES.ACTIVE,
    backend: 'server/routes/ai.js',
    frontendCallers: ['client/src/pages/SalesCoach/modules/TrainingCenter/TrainingCenter.jsx'],
    usesAIContextBuilder: false,
    usesPromptAdapter: false,
    usesAIExecutionEngine: false,
    notes: 'Deletes Training Center items; no model generation.',
  },
]);

export function listAIEndpoints() {
  return AI_ENDPOINT_INVENTORY;
}

export function listGenerationEndpoints() {
  return AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.category === AI_ENDPOINT_CATEGORIES.GENERATION);
}

export function listDeprecatedAIEndpoints() {
  return AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.status === AI_ENDPOINT_STATUSES.DEPRECATED);
}

export function listCompatibilityAIEndpoints() {
  return AI_ENDPOINT_INVENTORY.filter((endpoint) => endpoint.status === AI_ENDPOINT_STATUSES.COMPATIBILITY);
}

export function listSoftDeprecatedAIEndpoints() {
  return AI_ENDPOINT_INVENTORY.filter((endpoint) => (
    endpoint.status === AI_ENDPOINT_STATUSES.DEPRECATED
    || endpoint.status === AI_ENDPOINT_STATUSES.COMPATIBILITY
  ));
}

export default {
  AI_ENDPOINT_CATEGORIES,
  AI_ENDPOINT_STATUSES,
  AI_ENDPOINT_INVENTORY,
  listAIEndpoints,
  listGenerationEndpoints,
  listDeprecatedAIEndpoints,
  listCompatibilityAIEndpoints,
  listSoftDeprecatedAIEndpoints,
};
