# Data Layer Production Readiness

This document maps the current Green Shield CRM persistence layer and lays out the database migration path. It is an audit and planning document only. It does not change runtime behavior and does not start a Postgres migration.

## Current Storage Map

| Area | Current storage | Files/services | Criticality | Scaling risk | Notes |
| --- | --- | --- | --- | --- | --- |
| Leads | Google Sheets `Lead Responses` rows, resolved through the Integration Resolver | `server/services/sheets.js`, `server/services/integrationResolver.js`, `server/services/crmData/leadQueries.js`, `server/routes/leads.js` | Business-critical | Critical | Sheets row numbers are the operational lead ids. Updates write back to sheet columns A:O. |
| Lead ownership | JSON sidecar store, with AH/admin fallback for unmigrated rows | `server/services/leadOwnership.js`, `server/services/leadOwnershipStore.js`, default `server/data/lead-ownership.json` | Business-critical | High | Temporary compatibility layer. It must be swappable to a database without caller changes. |
| Replies and conversations | Google Sheets reply fields plus JSON append-only thread/read-state store | `server/services/conversationMessages.js`, `server/services/crmData/replies/replyQueries.js`, `server/routes/messages.js`, `server/routes/replies.js`, default `server/data/conversation-messages.json` | Business-critical | High | Read state can also persist to the sheet `replies_last_read_at` column. Threads are keyed by sheet row number. |
| Users and organizations | File-backed JSON | `server/services/organizationUsers.js`, `server/routes/adminUsers.js`, default `server/data/internal-tenancy.json` | Business-critical | High | Internal multi-user foundation. No production persistent-disk guard yet. |
| Integration profiles | File-backed JSON seeded from env vars for AH | `server/services/organizationIntegrations.js`, `server/routes/adminIntegrations.js`, default `server/data/organization-integrations.json` | Business-critical | High | Future source for Sheets/Gmail/Twilio config. Some production services still use env values directly. |
| Dashboard data | Derived from CRM Data Layer and lead queries; no dedicated dashboard store | `server/services/crmData/dashboard/*`, `server/routes/dashboard.js` | Business-critical read path | High | Large reads recompute metrics from visible leads and message data. |
| Activity log | File-backed JSON | `server/services/activity.js`, `server/routes/activity.js`, default `server/data/activity.json` | Audit/support | Medium | Useful for operational history; not currently a strongly consistent audit log. |
| Activity error completions | Google Sheets activity/error list plus in-process or service state | `server/services/activityErrors.js`, `server/services/activityErrorCompletions.js`, `server/routes/activityErrors.js` | Operational | Medium | Depends on `ERROR_LIST_SHEET_ID` and row ranges. |
| Error Center logs | Durable JSON with production write-safety checks | `server/services/errorLogService.js`, `server/routes/errors.js`, default `server/data/crm-error-log.json`, optional `ERROR_LOG_DATA_DIR` or `KNOWLEDGE_DATA_DIR/error-center` | Audit/log-only but important | Medium | Has dedupe, timeline, deployment metadata, and Render persistent-storage guard. |
| AI usage logs | Durable JSON with production write-safety checks | `server/services/ai/AIUsageLogService.js`, `server/routes/ai.js`, default `server/data/ai-usage-log.json`, optional `AI_USAGE_LOG_DATA_DIR` or `KNOWLEDGE_DATA_DIR/ai-usage` | Audit/log-only | Medium | Stores operational metadata only; no prompts, raw responses, or customer content. |
| AI provider health/config | Computed from environment variables at request time | `server/services/ai/AIProviderHealthService.js` | Diagnostic | Low | No persistence and no live provider calls. |
| Knowledge Base documents | JSON files plus uploaded file directory under configurable data dir | `server/services/knowledgeBase/knowledgeStorage.js`, `knowledgeBaseService.js`, `ingestionPipeline.js`, `extractionService.js`, `server/routes/knowledgeBase.js` | Business-critical | High | Production path should be `KNOWLEDGE_STORAGE_BACKEND=persistent_disk` and `KNOWLEDGE_DATA_DIR=/var/data/knowledge-base` until database/object storage migration. |
| Knowledge Base extracted text/chunks | JSON files | `knowledge-base-items.json`, `knowledge-base-chunks.json`, `knowledgeBaseService.js` | Business-critical | High | Needed for Sales Coach/RAG. Full-file reads/writes do not scale. |
| Knowledge Base embedding metadata/vectors | JSON file | `knowledge-base-embeddings.json`, `server/services/embeddingService.js`, `server/services/ai/embeddings/embeddingProvider.js` | Business-critical for semantic retrieval | High | Vectors in JSON are not suitable for large corpora or concurrent writes. |
| Uploaded Knowledge Base files | Filesystem upload directory | `knowledge-uploads/` under `KNOWLEDGE_DATA_DIR` or `server/data` | Business-critical | High | Should eventually move to object storage or DB/object-storage hybrid. |
| Sales Coach training items | File-backed JSON | `server/services/trainingService.js`, default `server/data/training-items.json` | Business-critical for coaching quality | High | No production persistence guard; no org/user partitioning beyond current app-level assumptions. |
| Sales Coach sessions | File-backed JSON | `server/services/trainingService.js`, default `server/data/sales-coach-sessions.json` | Useful operational history | Medium | Used for coaching session history and feedback/outcomes. |
| Objection feedback/cases | File-backed JSON plus embedding JSON | `server/services/objectionKnowledge.js`, `server/data/objection-feedback.json`, `server/data/objection-feedback-embeddings.json` | Business-critical AI memory | High | Appends cases and vectors, max 1000 entries. Should become relational rows plus vector store/table. |
| Static objection knowledge | Repo file | `server/knowledge/objection_assistant_coach.md`, `server/services/objectionKnowledge.js` | Config/knowledge | Low | Versioned with code, safe as source-controlled static content. |
| Agreement signing sessions/assets | Filesystem storage | `server/services/agreementSigning/storage.js`, signing routes/services | Business-critical during active signing windows | High | Public signing links depend on session and generated file availability. Should be database/object storage backed. |
| Generated PDFs/previews | Filesystem and generated buffers | `server/routes/documents.js`, PDF services, agreement signing services | Business-critical artifacts | High | Signed agreements and previews should not depend on deploy filesystem. |
| Route matrix/polyline cache | File-backed cache | `server/services/routeMatrixCache.js`, default `server/data/route-matrix-cache` | Generated/cache-like | Low | Safe to regenerate, but useful for cost/performance. |
| Technician photo cache | File-backed cache | `server/services/technicianPhotoCatalog.js`, default `server/data/technician-photos-cache.json` | Generated/cache-like | Low | Safe to rebuild from source if provider remains available. |
| RentCast usage/cache | In-memory and/or file/service cache depending on helper | `server/services/rentCastPropertyCache.js`, `rentCastUsageTracker.js`, `rentCastPropertyRecords.js` | Operational/cost-control | Medium | Free-tier usage tracking should be durable if used for hard limits. |
| FieldRoutes auth/preload state | External provider plus local diagnostics/state | `server/services/fieldRoutesAuth.js`, `fieldRoutesPreloader.js`, `fieldRoutesCron.js` | Operational | Medium | Provider-owned operational data; local auth state must be treated as sensitive. |
| Nominatim/geocoder cache | In-memory `Map` queue/cache | `server/services/nominatimGeocoder.js` | Generated/cache-like | Low | Safe to lose; rate-limit behavior may degrade after restart. |
| AI rate-limit buckets | In-memory `Map` | `server/security/aiRequestGuards.js` | Abuse protection | Medium | Resets on restart and does not work across multiple server instances. |
| Session logger | File-backed JSON under `server/data/sessions` | `server/services/sessionLogger.js` | Debug/support | Low | Not a primary CRM record. |
| Google credentials and env config | Environment variables / service account JSON | `server/services/googleCredentials.js`, `process.env.*` | Configuration/secrets | High | Must remain outside source control and migrate to secret manager/config tables as appropriate. |

## Persistence Mechanisms Found

- Google Sheets: live lead data, activity/error list data, some reply/read-state fields.
- File-backed JSON in `server/data`: users, integration profiles, ownership, conversations, activity, errors, KB data, training, sessions, AI usage, objection feedback, caches.
- Configurable persistent disk JSON: Knowledge Base, Error Center, AI usage log.
- Filesystem uploads/artifacts: Knowledge Base uploads, agreement/PDF assets, signing assets, route and technician caches.
- In-memory state: rate-limit buckets, geocoder cache/queue, some provider/client caches, test stores.
- External provider-owned data: Google Sheets/Drive/Gmail, Twilio, FieldRoutes, RentCast, OpenAI/Anthropic.

## Data Classification

### Business-Critical Data

- Leads and lead status.
- Lead ownership.
- Replies/conversation history and read state.
- Users, organizations, roles, statuses.
- Integration profiles.
- Knowledge Base documents, extracted text, chunks, embeddings, tags, status, errors.
- Sales Coach training items and approved responses.
- Objection feedback/cases when used as AI memory.
- Generated agreements and signed agreement artifacts.

### Audit / Log Data

- Error Center logs.
- AI usage logs.
- Activity log.
- Admin actions once implemented.
- Signing lifecycle events.
- Integration health history once implemented.

### Generated / Cache-Like Data

- Route matrix/polyline cache.
- Technician photo cache.
- Geocoder response cache.
- Provider health response.
- PDF previews that can be regenerated from canonical agreement records.

### Safe To Lose

Only caches should be considered safe to lose: route matrix cache, technician photo cache, geocoder cache, and temporary extraction/transcription chunks. Anything representing customer records, training knowledge, signatures, messages, users, or configuration must be backed up.

### Must Be Backed Up

- Google Sheets until fully replaced.
- All file-backed production JSON stores.
- Knowledge Base upload directory.
- Generated/signed agreements.
- Integration profile data.
- Error and AI usage history if used for operational accountability.

## Bottlenecks

| Rank | Bottleneck | Severity | Why it matters |
| --- | --- | --- | --- |
| 1 | Google Sheets as primary CRM database | Critical | Sheets API limits, row-level update fragility, weak transaction semantics, and manual sheet edits make high-volume multi-user use risky. |
| 2 | `row_number` as cross-system identity | Critical | Insertions, deletes, sorting, or sheet restructuring can shift row numbers and break ownership, messages, signing, replies, AI context, and dashboard links. |
| 3 | File-backed JSON for business-critical data | Critical | Full-file reads/writes have concurrency risks, no indexes, limited durability on ephemeral disks, and poor behavior under multiple server instances. |
| 4 | Mixed source of truth across Sheets plus sidecar stores | High | Leads live in Sheets while ownership/messages/read state live elsewhere, creating mismatch risk during updates, imports, or recovery. |
| 5 | Lack of indexes and pagination | High | Dashboard, replies, search, and KB retrieval can become slow as lead/message/document counts grow. |
| 6 | No durable background job framework | High | Long-running ingestion, transcription, embedding, syncing, and backfills are difficult to retry, resume, or inspect safely. |
| 7 | Production disk variability | High | Some stores guard Render persistent disk; older stores still write to `server/data` by default and could be lost on redeploy. |
| 8 | In-memory limits and caches | Medium | Rate limits and caches reset on restart and do not coordinate across multiple instances. |
| 9 | Backup/restore is not unified | Medium | Each store has a different path and durability model, making full CRM recovery hard to prove. |
| 10 | External provider coupling | Medium | Google Sheets, FieldRoutes, Twilio, Gmail, RentCast, OpenAI, and Anthropic availability affects CRM workflows without a unified retry/job/audit layer. |

## Future Postgres Target Model

Do not implement these tables yet. This is the target model for design work.

### Core

| Table group | Replaces | Why it matters | Migration difficulty | Dual-write needed |
| --- | --- | --- | --- | --- |
| `organizations` | Seeded JSON organization | First-class company boundary. | Low | Yes during transition. |
| `users` | `internal-tenancy.json` users | Durable user identity, status, audit fields. | Medium | Yes. |
| `user_roles` | Role strings in JSON | Normalizes roles for future expansion. | Low | Optional initially. |
| `user_permissions` | Static capability maps | Enables capability-based authorization. | Medium | Later stage. |
| `integration_profiles` | `organization-integrations.json` and env fallbacks | Durable per-user Sheets/Gmail/Twilio/FieldRoutes config. | Medium | Yes. |

### CRM

| Table group | Replaces | Why it matters | Migration difficulty | Dual-write needed |
| --- | --- | --- | --- | --- |
| `leads` | Google Sheets lead rows | Stable lead ids, indexes, pagination, ownership. | High | Yes, with Sheets as compatibility layer. |
| `lead_contacts` | Lead phone/email columns | Multi-contact support and dedupe. | Medium | Yes. |
| `lead_ownership` | `lead-ownership.json` | Stable owner history independent of row number. | Medium | Yes. |
| `lead_status_history` | Sheet status columns and activity logs | Auditable lifecycle transitions. | Medium | Yes. |
| `conversations` | Row-number keyed thread store | Stable conversation identity. | High | Yes. |
| `conversation_messages` | `conversation-messages.json` and reply columns | Durable SMS/email history. | High | Yes. |
| `replies_read_state` | Thread read-state JSON and sheet `replies_last_read_at` | Per-user read state. | Medium | Yes. |
| `followups` | Sheet status/sent/error fields and automation state | Reliable follow-up scheduling. | High | Yes. |
| `customer_notes` | Lead notes columns | Searchable note history. | Medium | Optional. |

### Operations

| Table group | Replaces | Why it matters | Migration difficulty | Dual-write needed |
| --- | --- | --- | --- | --- |
| `dashboard_activity` | `activity.json` | Durable activity feed. | Low | Yes. |
| `route_planning_jobs` | Route cache/runtime state | Auditable route runs and retry state. | Medium | Optional initially. |
| `technician_profiles` | Technician photo/cache helpers if needed | Stable technician metadata. | Low | No if cache-only. |
| `integration_sync_jobs` | Ad hoc sync routes/jobs | Unified retryable sync operations. | High | New table. |

### AI

| Table group | Replaces | Why it matters | Migration difficulty | Dual-write needed |
| --- | --- | --- | --- | --- |
| `ai_usage_logs` | AI usage JSON | Queryable AI observability and cost analytics. | Low | Yes. |
| `ai_provider_health_snapshots` | Current computed health only | Optional historical health trend. | Low | No. |
| `ai_prompt_versions` | Prompt text in code | Future prompt audit/versioning. | Medium | Later. |
| `ai_eval_runs` | None | Future regression testing. | Medium | New table later. |
| `ai_deprecated_route_hits` | Safe metadata inside AI usage logs | Optional dedicated monitoring. | Low | No if usage logs remain sufficient. |

### Knowledge Base

| Table group | Replaces | Why it matters | Migration difficulty | Dual-write needed |
| --- | --- | --- | --- | --- |
| `kb_documents` | `knowledge-base-items.json` | Durable document metadata/status/errors. | High | Yes. |
| `kb_chunks` | `knowledge-base-chunks.json` | Indexed retrieval and RAG context. | High | Yes. |
| `kb_embeddings` | `knowledge-base-embeddings.json` | Vector retrieval; may use pgvector. | High | Yes. |
| `kb_extraction_jobs` | Ingestion runtime state | Retry/resume large file processing. | Medium | New table. |
| `kb_tags` | Inline tags on items | Search/filter taxonomy. | Low | Yes. |
| Object storage references | Upload directory | Durable original files and generated artifacts. | High | Yes, likely S3-compatible storage. |

### Audit

| Table group | Replaces | Why it matters | Migration difficulty | Dual-write needed |
| --- | --- | --- | --- | --- |
| `audit_log` | Partial activity/error logs | Immutable system-wide audit trail. | Medium | Yes. |
| `admin_action_log` | Not centralized | Accountability for user/integration/config changes. | Low | New table. |
| `integration_health_log` | Current diagnostics only | Historical provider/integration reliability. | Low | Optional. |
| `error_log` | Error Center JSON | Queryable error tracking and timeline. | Medium | Yes. |

## Migration Strategy

### Stage 27: Postgres Schema Design

Design tables, primary keys, foreign keys, indexes, enum strategy, migration naming, and seed data. Do not wire production traffic yet.

### Stage 28: Database Connection And Migration Tooling

Add a database client, migration runner, local/test database setup, Render env docs, and health checks. Keep current stores as source of truth.

### Stage 29: Repository Interfaces Over Current Stores

Create repository interfaces for users, integration profiles, ownership, leads, conversations, KB, errors, and AI usage. Initially adapt them to existing Sheets/JSON stores.

### Stage 30: Dual-Write For Low-Risk Data

Start with append-only or low-risk domains such as AI usage logs, Error Center logs, activity logs, and admin actions. Current reads stay unchanged.

### Stage 31: Backfill From Google Sheets/JSON To Postgres

Build repeatable backfill scripts. Backups must be created before import. Each backfill should be idempotent and produce reconciliation reports.

### Stage 32: Read-From-Postgres Feature Flags

Add per-domain read flags. Start with admin-only observability and logs, then users/integrations, then CRM read paths.

### Stage 33: Leads/Replies/Dashboard Query Migration

Move the CRM Data Layer to read from Postgres behind feature flags. Keep Google Sheets dual-write/export behavior until confidence is high.

### Stage 34: Remove File-Backed Production Dependencies

Disable production writes to business-critical JSON files. Keep local/dev JSON adapters only if useful for tests and demos.

### Stage 35: Backup/Restore Validation

Create backup schedules, restore drills, object storage recovery checks, and documented RPO/RTO targets.

### Stage 36: Performance/Load Testing

Load test dashboard, replies, lead search, KB search, AI usage, and sync jobs. Add indexes and pagination based on observed query plans.

### Why Dual-Write And Feature Flags Are Required

Dual-write lets the CRM prove Postgres receives the same data as existing Sheets/JSON stores before reads switch over. Feature flags allow a rollback to current behavior if reconciliation fails, without losing production continuity.

## Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Data mismatch between Sheets and Postgres | Wrong dashboard/replies/follow-up state | High | Dual-write, reconciliation reports, row-level checksums. |
| Duplicate lead rows | Duplicate follow-ups, replies, agreements | Medium | Stable lead ids, dedupe constraints, import idempotency keys. |
| `row_number` instability | Ownership/messages/signing links point to wrong lead | High | Introduce immutable `lead_id`; store sheet row as integration metadata only. |
| Failed dual-write | Postgres misses updates | Medium | Transactional outbox/retry queue, alerting, reconciliation jobs. |
| Missed SMS/email reply sync | Customer replies lost or shown to wrong user | Medium | Durable conversation messages, inbound event log, replayable webhooks. |
| User access mismatch | Data leak across reps/orgs | Medium | Server-side authorization tests, row-level org/user constraints, audit logs. |
| Lost AI usage logs | Reduced observability/cost audit | Medium | Move to `ai_usage_logs`, backup, keep JSON fallback only for dev. |
| Local disk not persistent | Lost users, training, KB, conversations, errors | High | Persistent disk now, Postgres/object storage later, startup write-safety checks. |
| Bad backfill | Corrupt or incomplete database state | Medium | Backups, dry runs, idempotent scripts, validation reports. |
| Slow dashboard queries | Poor UX at scale | High | Indexed Postgres queries, materialized summaries if needed, pagination. |
| Migration rollback | Partial system cutover failure | Medium | Feature flags per read/write path, dual-write retention window, documented rollback steps. |
| Vector migration mistakes | RAG quality regression | Medium | Keep source chunks, compare retrieval results, pgvector acceptance tests. |
| Provider sync outages | Missing external updates | Medium | Durable sync jobs, retry queues, provider health logs. |

## Definition Of Done For A 9.8/10 Or 10/10 Data Layer

- Postgres is the primary source of truth for production CRM data.
- Google Sheets is an integration/export layer, not the primary database.
- Migrations are versioned, reviewed, and repeatable.
- Backups are automated.
- Restore has been tested from backup.
- Feature flags exist for high-risk read/write migrations.
- Dual-write reconciliation passes before cutover.
- No production-critical business data depends on file-backed JSON.
- Knowledge Base original files live on persistent object storage or equivalent durable storage.
- Signed agreements and generated artifacts are durable and recoverable.
- Admins can see storage health and migration status.
- High-traffic queries have indexes and query-plan reviews.
- Large lists use pagination.
- Dashboard/replies/search/load tests pass at target scale.
- Background jobs are durable, retryable, and observable.
- Rollback is documented for each migration stage.
- Data access enforces organization/user scope server-side.

## Immediate Recommendations Before Stage 27

1. Freeze new production-critical JSON stores unless they are explicitly documented as temporary adapters.
2. Treat `leadOwnershipStore.js` as a compatibility adapter, not a permanent persistence model.
3. Add startup storage warnings for older critical JSON stores before production expansion.
4. Design stable IDs before any lead migration; do not carry `row_number` forward as the primary key.
5. Start database work with append-only logs and admin metadata before migrating live lead writes.
