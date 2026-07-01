# AI Migration Architecture Closeout

This document is the production-readiness reference for the Green Shield CRM AI migration. It describes the current AI endpoint surface, provider boundaries, usage logging, sensitive-data policy, observability routes, and deprecated-route removal checklist.

## AI Endpoint Surface

The canonical endpoint inventory lives in `server/services/ai/AIEndpointInventory.js`. Every `server/routes/ai.js` route must be represented there.

### Active Generation Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/ai/assist-reply` | Interactive Replies copilot. |
| POST | `/api/ai/sales-coach/module` | Primary Sales Coach module endpoint. |
| POST | `/api/ai/sales-coach` | Legacy Intake Sales Coach flow with an active frontend caller. |
| POST | `/api/ai/objection-assist` | Dedicated Intake Objection Assistant endpoint. |

### Deprecated / Compatibility Endpoints

| Method | Path | Replacement | Status |
| --- | --- | --- | --- |
| POST | `/api/ai/draft-reply` | `/api/ai/assist-reply` | Deprecated |
| POST | `/api/ai/coach-objection` | `/api/ai/sales-coach/module` | Compatibility |

Both routes remain available. They emit `Deprecation: true` and `X-GreenShield-Replacement` headers, and their usage is tracked with safe AI usage metadata.

### Admin-Only Observability Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/ai/health` | Passive AI provider configuration health. |
| GET | `/api/ai/usage` | Sanitized AI usage log entries and summary. |
| GET | `/api/ai/usage/storage` | Sanitized AI usage-log storage status. |

These routes are gated by `requireAdmin`. The admin UI entry point is `/admin/ai-observability`.

### Feedback, Session, And Training Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/ai/objection-feedback` | Persists human feedback; no model generation. |
| POST | `/api/ai/objection-outcome` | Persists sales outcomes/cases; no model generation. |
| GET | `/api/ai/sales-coach/sessions` | Lists Sales Coach sessions; no model generation. |
| GET | `/api/ai/sales-coach/training` | Lists Training Center items; no model generation. |
| POST | `/api/ai/sales-coach/training` | Creates Training Center items; no model generation. |
| PUT | `/api/ai/sales-coach/training/:id` | Updates Training Center items; no model generation. |
| DELETE | `/api/ai/sales-coach/training/:id` | Deletes Training Center items; no model generation. |

## Provider Boundaries

Only provider boundary files may directly import provider SDKs:

- `server/services/ai/execution/AIExecutionEngine.js`
- `server/services/ai/embeddings/embeddingProvider.js`
- `server/services/ai/extraction/transcriptionProvider.js`

No route, business service, prompt adapter, context builder, Knowledge Base service, Sales Coach service, Error Center route, or CRM data service should directly import OpenAI or Anthropic SDKs.

Current provider responsibilities:

- `AIExecutionEngine.js`: Anthropic chat/vision/generation execution.
- `embeddingProvider.js`: OpenAI embeddings API.
- `transcriptionProvider.js`: OpenAI Whisper transcription API.

## Usage Logging

AI usage is persisted through `server/services/ai/AIUsageLogService.js`.

Coverage:

- `AIExecutionEngine.js` records generation, vision/OCR, summarization, and analysis requests.
- `embeddingProvider.js` records embedding requests.
- `transcriptionProvider.js` records transcription requests.

Stored fields are operational metadata only:

- id
- timestamp
- endpoint
- feature
- provider
- model
- durationMs
- inputSize
- outputSize
- success
- errorCode
- status
- requestId when present
- organizationId/userId/source when safely provided
- safe metadata keys only

Safe metadata keys currently allowed:

- `inputCount`
- `fileSizeBytes`
- `extension`
- `deprecatedRoute`
- `deprecatedPath`
- `replacementPath`

Storage behavior:

- `AI_USAGE_LOG_DATA_DIR` takes precedence.
- Otherwise, `KNOWLEDGE_DATA_DIR/ai-usage` is used when configured.
- Otherwise, local `server/data` is used for development.
- On Render production, writes are refused unless storage is configured as durable persistent storage.
- Unsafe production storage is reported to the Error Center through a sanitized `AI_USAGE_LOG_STORAGE_UNSAFE` error.

## Sensitive Data Policy

AI usage logs and AI Observability must never store or display:

- prompts
- customer messages
- lead context
- document text
- transcripts
- transcript segments
- embedding vectors
- raw provider responses
- parsed model JSON
- request bodies
- authorization headers
- API keys
- bearer tokens
- cookies
- passwords
- secrets

`AIUsageLogService` and AI Observability helper tests enforce this by allowlisting safe fields and stripping forbidden raw-content fields.

## Admin Observability

The admin page at `/admin/ai-observability` reads:

- `GET /api/ai/health`
- `GET /api/ai/usage`
- `GET /api/ai/usage/storage`

The page shows provider configuration health, durable storage status, usage summaries, recent sanitized entries, and deprecated route traffic indicators. It does not show prompts, customer text, raw provider output, or secrets.

## Deprecated Route Removal Checklist

Do not remove deprecated routes until deprecated traffic has been monitored.

For each deprecated or compatibility route:

1. Confirm `/api/ai/usage` shows zero `deprecatedRoute` hits for that route for at least 30 days.
2. Confirm no external caller depends on the endpoint.
3. Remove the route handler from `server/routes/ai.js`.
4. Remove the client compatibility wrapper from `client/src/api/client.js` if present.
5. Remove deprecated route tests.
6. Update `server/services/ai/AIEndpointInventory.js`.
7. Update inventory tests.
8. Run the full server suite.
9. Run the client build.

Route-specific checklists are also stored on the soft-deprecated inventory entries in `AIEndpointInventory.js`. `sunsetTarget` remains `null` until a removal date is explicitly approved.

## Tests Protecting This Architecture

Key test coverage:

- `server/services/ai/__tests__/AIEndpointInventory.test.js`
- `server/services/ai/__tests__/providerAccess.test.js`
- `server/services/ai/__tests__/AIProviderHealthService.test.js`
- `server/services/ai/__tests__/AIUsageLogService.test.js`
- `server/services/ai/execution/__tests__/AIExecutionEngine.test.js`
- `server/routes/__tests__/aiHealth.test.js`
- `server/routes/__tests__/aiUsage.test.js`
- `server/routes/__tests__/aiAssistReply.test.js`
- `server/routes/__tests__/aiDraftReply.test.js`
- `server/routes/__tests__/aiCoachObjection.test.js`
- `server/routes/__tests__/aiObjectionAssist.test.js`
- `client/src/pages/Admin/AIObservability/__tests__/aiObservabilityHelpers.test.js`

Together these tests verify endpoint inventory coverage, provider boundary isolation, admin-only observability routes, usage-log sanitization, deprecated route telemetry, and behavior-compatible AI route responses.
