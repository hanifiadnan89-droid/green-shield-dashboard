# Postgres Schema Design

This document defines the future Postgres data model for the Green Shield CRM. It is a schema design artifact only. It does not add a database client, migrations, runtime reads, runtime writes, or live data migration.

## Design Goals

- Replace the current hybrid Google Sheets plus JSON/file-backed storage model with a durable relational source of truth.
- Eliminate `row_number` as the application identity for leads.
- Preserve Google Sheets compatibility during migration through mapping tables and feature flags.
- Keep organization and user scope explicit on business-critical tables.
- Support dual-write, reconciliation, rollback, indexing, pagination, and future multi-organization growth.
- Keep large binary files in object storage or a durable file/object layer, not directly in Postgres unless intentionally revisited.

## Current Entity Audit

| Area | Current entities | Current identity | Current storage |
| --- | --- | --- | --- |
| Core identity | Organization, user, role, capability | Seeded ids such as `org_green_shield`, `user_ah` | `organizationUsers.js` JSON |
| Integrations | User integration profile, Google Sheets ids, Gmail sender, Twilio number | `integration_${userId}` | `organizationIntegrations.js` JSON plus env fallback |
| Leads | Lead row, status fields, stop/sold/deleted flags, reply fields | Google Sheets `row_number` | Google Sheets `Lead Responses` |
| Contacts | Lead phone/email columns | Embedded in lead row | Google Sheets columns |
| Ownership | Lead owner, org, created/updated audit | `rowNumber` sidecar key | `lead-ownership.json` |
| Conversations | Thread per lead, messages, read cursor | `rowNumber` thread key, generated message ids | `conversation-messages.json` plus sheet `replies_last_read_at` |
| Dashboard | Summary, pipeline, follow-ups, activity | Derived | CRM Data Layer over leads/messages/activity |
| AI usage | Execution metadata | `ai_usage_...` | `ai-usage-log.json` |
| Errors | Error records, timeline, deployment metadata, AI analysis | `err_...` | `crm-error-log.json` |
| Knowledge Base | Documents, chunks, embeddings, tags, uploads, extraction status | JSON item/chunk ids and file paths | Knowledge Base JSON files plus upload directory |
| Training | Training items, Sales Coach sessions, objection feedback | JSON ids | JSON files in `server/data` |
| Generated artifacts | PDFs, previews, signing assets | File paths/session tokens | Filesystem |
| Caches | Geocoder, route matrix, provider/rate-limit state | Cache keys | Files/in-memory/external providers |

## Stable ID Strategy

Postgres primary keys should use stable generated ids. The exact generator can be chosen during implementation, but all application-facing ids should be independent of Google Sheets row numbers.

Recommended id prefixes:

| Entity | Stable id |
| --- | --- |
| Organization | `org_...` |
| User | `usr_...` or existing-compatible `user_...` |
| Integration profile | `int_...` |
| Lead | `lead_...` |
| Lead contact | `lead_contact_...` |
| Conversation | `conv_...` |
| Message | `msg_...` |
| Follow-up | `followup_...` |
| KB document | `kb_doc_...` |
| KB chunk | `kb_chunk_...` |
| KB embedding | `kb_embedding_...` |
| AI usage | `ai_usage_...` |
| Error | `err_...` |
| Audit log | `audit_...` |

`row_number` remains only as integration metadata. The future mapping is:

```text
current sheet row_number -> lead_sheet_mappings(row_number, spreadsheet_id, sheet_name) -> lead_id
```

Application routes should eventually accept `lead_id`. During migration, row-number routes can resolve through `lead_sheet_mappings`.

## Organization Scope

Most production tables require `organization_id` so authorization can be enforced in SQL and repositories:

- `users`
- `integration_profiles`
- `leads`
- `lead_contacts`
- `lead_ownership`
- `lead_status_history`
- `conversations`
- `conversation_messages`
- `replies_read_state`
- `followups`
- `customer_notes`
- `dashboard_activity`
- `integration_sync_jobs`
- `kb_documents`
- `kb_chunks`
- `kb_embeddings`
- `ai_usage_logs`
- `error_log`
- `audit_log`

Provider-agnostic lookup tables such as role names or permission names may omit `organization_id` if they are global definitions.

## Core Tables

### `organizations`

Purpose: first-class company boundary.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable organization id. |
| `name` | text not null | Company display name. |
| `slug` | text not null | Unique URL/config slug. |
| `branding` | jsonb | Logo, colors, public display settings. |
| `phone_numbers` | jsonb | Organization-level phone numbers. |
| `address` | jsonb | Organization address. |
| `default_settings` | jsonb | Org defaults and feature flags. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Primary key: `id`.
- Unique: `slug`.
- Index: `organizations(slug)`.

Replaces: seeded organization in `internal-tenancy.json`.

Migration notes: seed `Green Shield Pest Solutions` as the first organization, preserving the current `org_green_shield` id if practical.

### `users`

Purpose: durable user identity and status.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable user id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `name` | text not null | Legal/internal name. |
| `display_name` | text | UI name. |
| `email` | citext or text not null | Normalized email. |
| `initials` | text not null | Sheet/rep code such as AH. |
| `role` | text not null | Compatibility role: `admin`, `manager`, `sales_rep`. |
| `status` | text not null | `active` or `inactive`. |
| `timezone` | text | User timezone. |
| `preferences` | jsonb | UI and communication preferences. |
| `auth_username` | text | Existing-login compatibility metadata. |
| `created_by` | text | User/admin/system actor. |
| `updated_by` | text | User/admin/system actor. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Primary key: `id`.
- Foreign key: `organization_id`.
- Unique: `(organization_id, lower(email))`.
- Unique: `(organization_id, upper(initials))`.
- Index: `users(organization_id, status)`.
- Index: `users(organization_id, role)`.

Replaces: user rows in `internal-tenancy.json`.

Migration notes: seed AH as active admin/owner-equivalent. Keep existing username fallback until auth is migrated.

### `user_roles`

Purpose: normalize role definitions while preserving the current simple role model.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Role id. |
| `name` | text not null | `admin`, `manager`, `sales_rep`; future roles allowed. |
| `description` | text | Human-readable purpose. |
| `system` | boolean not null default true | Built-in vs custom. |
| `created_at` | timestamptz not null | Creation time. |

Constraints and indexes:
- Unique: `name`.

Replaces: static role strings over time.

Migration notes: optional early table; implementation can keep `users.role` during Stage 1 of DB migration and backfill assignments later.

### `user_permissions`

Purpose: future capability-based authorization.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Permission id. |
| `name` | text not null | Capability such as `manage_users`. |
| `description` | text | Capability description. |
| `created_at` | timestamptz not null | Creation time. |

Constraints and indexes:
- Unique: `name`.

Replaces: hardcoded capability maps later.

Migration notes: add role-permission join table later if capabilities become dynamic. Do not overcomplicate the first DB cutover.

### `integration_profiles`

Purpose: per-user external integration configuration.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable integration profile id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `user_id` | text not null references `users(id)` | Profile owner. |
| `google` | jsonb | Google connection metadata. |
| `master_lead_sheet_id` | text | Master lead sheet id. |
| `lead_responses_sheet_id` | text | Lead responses sheet id. |
| `customer_database_sheet_id` | text | Customer database sheet id. |
| `gmail` | jsonb | Gmail connection metadata. |
| `gmail_sender_email` | text | Sender email. |
| `twilio` | jsonb | Twilio connection metadata. |
| `twilio_phone_number` | text | Normalized assigned phone. |
| `twilio_messaging_service_sid` | text | Messaging service SID. |
| `field_routes` | jsonb | Future FieldRoutes config. |
| `notes` | text | Internal notes. |
| `created_by` | text | Actor id/system. |
| `updated_by` | text | Actor id/system. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Unique: `(organization_id, user_id)`.
- Index: `integration_profiles(organization_id)`.
- Index: `integration_profiles(twilio_phone_number)` where not null.
- Index: `integration_profiles(lead_responses_sheet_id)` where not null.

Replaces: `organization-integrations.json` and gradual env fallback.

Migration notes: seed AH profile from current env-backed values. Env vars remain fallback until read flags are enabled.

## CRM Tables

### `leads`

Purpose: stable CRM lead/customer opportunity record.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable `lead_id`. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `source` | text | Lead source. |
| `external_source` | text | Provider/source system. |
| `external_id` | text | External lead id when available. |
| `name` | text | Primary display name. |
| `service_type` | text | Pest/service context. |
| `reason` | text | Current sheet `reason` field. |
| `notes` | text | Current sheet `notes` field or latest notes summary. |
| `status` | text | Canonical lifecycle status. |
| `sent` | text | Compatibility/send state. |
| `error` | text | Compatibility error text. |
| `stop` | text | Stop/unsubscribe marker. |
| `deleted` | boolean not null default false | Current `deleted=yes` compatibility. |
| `sold` | boolean not null default false | Current `sold=yes` compatibility. |
| `computed_status` | text | Optional stored summary, can be derived. |
| `original_sheet_row_number` | integer | First imported row number only. |
| `created_by` | text | Actor/system. |
| `updated_by` | text | Actor/system. |
| `created_at` | timestamptz not null | Creation/import time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Primary key: `id`.
- Index: `leads(organization_id)`.
- Index: `leads(organization_id, status)`.
- Index: `leads(organization_id, created_at desc)`.
- Index: `leads(organization_id, updated_at desc)`.
- Index: `leads(organization_id, deleted)`.
- Optional unique: `(organization_id, external_source, external_id)` where `external_id` is not null.

Replaces: Google Sheets lead rows as the source of truth.

Migration notes: live lead migration comes late. Use `lead_sheet_mappings` for every imported row and reconcile row counts/checksums before DB reads are enabled.

### `lead_contacts`

Purpose: support multiple normalized phones/emails per lead.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable contact id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Parent lead. |
| `type` | text not null | `phone` or `email`. |
| `value` | text not null | Original value. |
| `normalized_value` | text not null | Normalized phone/email. |
| `label` | text | mobile, work, home, etc. |
| `is_primary` | boolean not null default false | Primary contact flag. |
| `source` | text | Sheet/import/provider. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Index: `lead_contacts(organization_id, lead_id)`.
- Index: `lead_contacts(organization_id, type, normalized_value)`.
- Unique partial index for one primary per type: `(lead_id, type)` where `is_primary = true`.

Replaces: embedded sheet `phone`, `phone_formatted`, and `email` columns.

Migration notes: import current sheet phone/email as primary contacts. Dedupe by normalized value inside organization.

### `lead_sheet_mappings`

Purpose: map stable `lead_id` to Google Sheets compatibility identifiers.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Mapping id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Stable lead. |
| `integration_profile_id` | text references `integration_profiles(id)` | Owning sheet profile if known. |
| `spreadsheet_id` | text not null | Google spreadsheet id. |
| `sheet_name` | text not null | Sheet/tab name. |
| `row_number` | integer not null | Current sheet row. |
| `row_range` | text | Optional A:O style range. |
| `active` | boolean not null default true | Current mapping flag. |
| `first_seen_at` | timestamptz not null | First import/sync time. |
| `last_seen_at` | timestamptz not null | Last sync time. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Unique active mapping: `(spreadsheet_id, sheet_name, row_number)` where `active = true`.
- Unique active lead/sheet: `(lead_id, spreadsheet_id, sheet_name)` where `active = true`.
- Index: `lead_sheet_mappings(organization_id, lead_id)`.
- Index: `lead_sheet_mappings(spreadsheet_id, sheet_name, row_number)`.

Replaces: direct route/service dependence on `row_number` as identity.

Migration notes: if Google Sheets rows move, mark old mapping inactive and create a new active mapping. Never mutate `lead_id`.

### `lead_ownership`

Purpose: definitive owner metadata and transfer state.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Ownership record id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Stable lead. |
| `owner_user_id` | text not null references `users(id)` | Current owner. |
| `created_by` | text | Actor/system. |
| `updated_by` | text | Actor/system. |
| `created_at` | timestamptz not null | Assignment creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Unique: `(organization_id, lead_id)`.
- Index: `lead_ownership(organization_id, owner_user_id)`.

Replaces: `lead-ownership.json`.

Migration notes: current sidecar is a temporary compatibility layer. Backfill by resolving row number through `lead_sheet_mappings`, defaulting existing unmigrated leads to AH/admin where the sidecar has no explicit record.

### `lead_status_history`

Purpose: auditable lifecycle changes.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Status event id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Stable lead. |
| `old_status` | text | Previous status. |
| `new_status` | text not null | New status. |
| `reason` | text | Optional reason. |
| `source` | text | Sheet/API/Twilio/Gmail/admin/import. |
| `actor_user_id` | text references `users(id)` | Actor when known. |
| `metadata` | jsonb | Safe metadata. |
| `created_at` | timestamptz not null | Event time. |

Constraints and indexes:
- Index: `lead_status_history(organization_id, lead_id, created_at desc)`.
- Index: `lead_status_history(organization_id, new_status, created_at desc)`.

Replaces: implicit status transitions in Sheets and activity logs.

Migration notes: initial backfill can create one imported status event per lead.

### `conversations`

Purpose: stable thread identity across SMS/email/mixed channels.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable conversation id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Parent lead. |
| `channel` | text not null | `sms`, `email`, or `mixed`. |
| `status` | text | open, waiting_on_customer, waiting_on_agent, closed. |
| `last_activity_at` | timestamptz | Latest message time. |
| `first_activity_at` | timestamptz | First message time. |
| `metadata` | jsonb | Safe thread metadata. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Index: `conversations(organization_id, lead_id)`.
- Index: `conversations(organization_id, last_activity_at desc)`.
- Unique optional: `(organization_id, lead_id, channel)` if one active thread per channel is retained.

Replaces: row-number keyed threads in `conversation-messages.json`.

Migration notes: create one conversation per row-number thread. Mixed SMS/email messages can share a conversation to match current UI behavior.

### `conversation_messages`

Purpose: durable inbound/outbound SMS/email messages.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Stable message id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `conversation_id` | text not null references `conversations(id)` | Parent conversation. |
| `lead_id` | text not null references `leads(id)` | Denormalized for queries. |
| `direction` | text not null | `inbound` or `outbound`. |
| `channel` | text not null | `sms` or `email`. |
| `body` | text | Message body. |
| `body_redacted` | text | Future optional redacted version. |
| `sender` | text | Sender display/address/phone. |
| `recipient` | text | Recipient address/phone. |
| `status` | text | Provider delivery/status. |
| `external_provider` | text | Twilio/Gmail/etc. |
| `external_message_id` | text | Provider message id. |
| `received_at` | timestamptz | Provider receive time. |
| `sent_at` | timestamptz | Send time. |
| `created_at` | timestamptz not null | Insert time. |
| `metadata` | jsonb | Safe operational metadata. |

Constraints and indexes:
- Index: `conversation_messages(organization_id, conversation_id, created_at)`.
- Index: `conversation_messages(organization_id, lead_id, created_at desc)`.
- Index: `conversation_messages(organization_id, channel, direction, created_at desc)`.
- Unique optional: `(external_provider, external_message_id)` where external id is not null.

Replaces: `conversation-messages.json`, sheet `sms_reply`, and sheet `email_reply` as long-term message history.

Migration notes: import current thread messages first, then synthesize messages from sheet reply columns only when no thread message already represents the same inbound text.

### `replies_read_state`

Purpose: per-user conversation read state.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Read-state id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `conversation_id` | text not null references `conversations(id)` | Conversation. |
| `user_id` | text not null references `users(id)` | Reader. |
| `last_read_message_id` | text references `conversation_messages(id)` | Last read message. |
| `last_read_at` | timestamptz | Read timestamp. |
| `metadata` | jsonb | Compatibility read keys if needed. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Unique: `(conversation_id, user_id)`.
- Index: `replies_read_state(organization_id, user_id)`.

Replaces: thread `lastReadAt`, `lastReadInboundKey`, `readInboundKeys`, and sheet `replies_last_read_at`.

Migration notes: preserve current read cursor in metadata until all message ids are stable.

### `followups`

Purpose: durable follow-up scheduling and state.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Follow-up id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Target lead. |
| `owner_user_id` | text references `users(id)` | Responsible rep. |
| `sequence_name` | text | Sequence or template. |
| `channel` | text | sms/email/call/task. |
| `status` | text not null | pending, sent, failed, skipped, canceled. |
| `due_at` | timestamptz | Scheduled time. |
| `sent_at` | timestamptz | Sent time. |
| `error` | text | Error summary. |
| `metadata` | jsonb | Safe metadata. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Index: `followups(organization_id, owner_user_id, due_at)`.
- Index: `followups(organization_id, status, due_at)`.
- Index: `followups(organization_id, lead_id)`.

Replaces: sheet `sent`, `error`, status-derived follow-up state, and future automation state.

Migration notes: backfill active follow-up state conservatively; live automation migration should be separate from schema setup.

### `customer_notes`

Purpose: searchable note history independent of the lead summary field.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Note id. |
| `organization_id` | text not null references `organizations(id)` | Tenant boundary. |
| `lead_id` | text not null references `leads(id)` | Parent lead. |
| `author_user_id` | text references `users(id)` | Author. |
| `body` | text not null | Note body. |
| `source` | text | sheet/api/import. |
| `created_at` | timestamptz not null | Creation time. |
| `updated_at` | timestamptz not null | Last update time. |

Constraints and indexes:
- Index: `customer_notes(organization_id, lead_id, created_at desc)`.

Replaces: overloaded sheet `notes` column later.

Migration notes: initial import can store the sheet note as one imported note per lead while keeping `leads.notes` for compatibility.

## Operations Tables

### `dashboard_activity`

Purpose: durable activity feed and operational history.

Columns: `id`, `organization_id`, `actor_user_id`, `lead_id`, `type`, `title`, `message`, `severity`, `metadata jsonb`, `created_at`.

Indexes:
- `dashboard_activity(organization_id, created_at desc)`.
- `dashboard_activity(organization_id, lead_id, created_at desc)`.

Replaces: `activity.json` and some derived activity feed state.

### `route_planning_jobs`

Purpose: durable route generation jobs and results.

Columns: `id`, `organization_id`, `created_by`, `status`, `input_snapshot jsonb`, `result_summary jsonb`, `error_code`, `error_message`, `started_at`, `finished_at`, `created_at`, `updated_at`.

Indexes:
- `route_planning_jobs(organization_id, status, created_at desc)`.

Replaces: ad hoc route runtime/cache state over time.

### `technician_profiles`

Purpose: stable technician metadata if technician routing becomes first-class.

Columns: `id`, `organization_id`, `name`, `email`, `phone`, `status`, `skills jsonb`, `home_base jsonb`, `photo_object_key`, `metadata jsonb`, `created_at`, `updated_at`.

Indexes:
- `technician_profiles(organization_id, status)`.

Replaces: technician cache files only if technician data becomes business-critical.

### `integration_sync_jobs`

Purpose: retryable Google/Gmail/Twilio/FieldRoutes sync operations.

Columns: `id`, `organization_id`, `integration_profile_id`, `provider`, `job_type`, `status`, `attempt_count`, `last_error_code`, `last_error_message`, `payload jsonb`, `next_run_at`, `locked_at`, `locked_by`, `created_at`, `updated_at`.

Indexes:
- `integration_sync_jobs(organization_id, status, next_run_at)`.
- `integration_sync_jobs(provider, job_type, status)`.

Replaces: one-off sync scripts/routes and untracked provider retries.

## AI Tables

### `ai_usage_logs`

Purpose: durable, queryable AI execution metadata.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | Existing `ai_usage_...` compatible id. |
| `organization_id` | text references `organizations(id)` | Tenant boundary when available. |
| `user_id` | text references `users(id)` | Actor when available. |
| `timestamp` | timestamptz not null | Usage timestamp. |
| `endpoint` | text | Route or internal endpoint name. |
| `feature` | text | Feature such as sales-coach or embeddings. |
| `provider` | text not null | anthropic/openai/etc. |
| `model` | text | Model name. |
| `duration_ms` | integer not null default 0 | Execution duration. |
| `input_size` | integer not null default 0 | Size estimate only. |
| `output_size` | integer not null default 0 | Size estimate only. |
| `success` | boolean not null | Success flag. |
| `status` | text not null | success/failure. |
| `error_code` | text | Controlled error code. |
| `request_id` | text | Request correlation id. |
| `source` | text | Provider wrapper/source. |
| `metadata` | jsonb | Safe metadata only. |
| `created_at` | timestamptz not null | Insert time. |

Indexes:
- `ai_usage_logs(timestamp desc)`.
- `ai_usage_logs(organization_id, timestamp desc)`.
- `ai_usage_logs(feature, timestamp desc)`.
- `ai_usage_logs(provider, timestamp desc)`.
- `ai_usage_logs(success, timestamp desc)`.

Replaces: `ai-usage-log.json`.

Migration notes: never store prompts, customer messages, document text, transcripts, embedding vectors, raw provider responses, parsed JSON responses, API keys, or secrets.

### `ai_provider_health_snapshots`

Purpose: optional historical AI configuration/health snapshots.

Columns: `id`, `organization_id`, `status`, `providers jsonb`, `capabilities jsonb`, `created_at`.

Indexes:
- `ai_provider_health_snapshots(created_at desc)`.

Replaces: no current persistent store; current health is computed.

### `ai_prompt_versions`

Purpose: future prompt audit and rollout control.

Columns: `id`, `organization_id`, `prompt_name`, `version`, `checksum`, `provider`, `model`, `active`, `metadata jsonb`, `created_by`, `created_at`.

Indexes and constraints:
- Unique: `(organization_id, prompt_name, version)`.
- Index: `ai_prompt_versions(prompt_name, active)`.

Replaces: prompt text embedded in code later.

### `ai_eval_runs`

Purpose: future AI regression/evaluation results.

Columns: `id`, `organization_id`, `prompt_version_id`, `feature`, `status`, `metrics jsonb`, `sample_count`, `created_by`, `created_at`, `finished_at`.

Indexes:
- `ai_eval_runs(organization_id, feature, created_at desc)`.

### `ai_deprecated_route_hits`

Recommendation: derive deprecated-route monitoring from `ai_usage_logs.metadata.deprecatedRoute` at first. Create this separate table only if operational queries become expensive or require dedicated retention.

If separated later, columns should include `id`, `organization_id`, `user_id`, `endpoint`, `replacement_path`, `success`, `error_code`, `request_id`, `created_at`.

## Knowledge Base Tables

### `kb_documents`

Purpose: durable Knowledge Base item metadata and status.

Columns: `id`, `organization_id`, `owner_user_id`, `title`, `source_type`, `mime_type`, `status`, `summary`, `extracted_text`, `processing_error`, `file_object_id`, `metadata jsonb`, `created_at`, `updated_at`.

Indexes:
- `kb_documents(organization_id, status)`.
- `kb_documents(organization_id, created_at desc)`.
- Optional full-text index on title/summary/extracted text after volume is known.

Replaces: `knowledge-base-items.json`.

Migration notes: if extracted text grows very large, split it into a separate document text table or object reference.

### `kb_chunks`

Purpose: durable retrieval chunks.

Columns: `id`, `organization_id`, `document_id`, `chunk_index`, `text`, `token_count`, `metadata jsonb`, `created_at`, `updated_at`.

Indexes and constraints:
- Unique: `(document_id, chunk_index)`.
- Index: `kb_chunks(organization_id, document_id)`.

Replaces: `knowledge-base-chunks.json`.

### `kb_embeddings`

Purpose: vector retrieval metadata and vectors.

Columns: `id`, `organization_id`, `document_id`, `chunk_id`, `provider`, `model`, `dimensions`, `embedding vector` or `embedding jsonb`, `created_at`.

Indexes:
- `kb_embeddings(organization_id, document_id)`.
- `kb_embeddings(chunk_id)`.
- If pgvector is available, use an ivfflat/hnsw vector index after data volume justifies it.

Replaces: `knowledge-base-embeddings.json`.

Migration notes: prefer pgvector for semantic retrieval. If pgvector is unavailable at first, store vectors as JSONB temporarily but do not consider that final.

### `kb_extraction_jobs`

Purpose: retryable extraction/OCR/transcription/embedding pipeline state.

Columns: `id`, `organization_id`, `document_id`, `job_type`, `status`, `attempt_count`, `progress`, `error_code`, `error_message`, `started_at`, `finished_at`, `created_at`, `updated_at`, `metadata jsonb`.

Indexes:
- `kb_extraction_jobs(organization_id, status, created_at desc)`.
- `kb_extraction_jobs(document_id, job_type)`.

Replaces: transient ingestion runtime state.

### `kb_tags` and `kb_document_tags`

Purpose: normalized KB taxonomy.

`kb_tags`: `id`, `organization_id`, `name`, `slug`, `created_at`.

`kb_document_tags`: `document_id`, `tag_id`, `created_at`.

Constraints and indexes:
- Unique: `kb_tags(organization_id, slug)`.
- Unique: `kb_document_tags(document_id, tag_id)`.

Replaces: inline tags on KB items.

### `kb_file_objects`

Purpose: references to uploaded originals and generated file artifacts.

Columns: `id`, `organization_id`, `document_id`, `storage_provider`, `bucket`, `object_key`, `filename`, `mime_type`, `size_bytes`, `checksum`, `created_at`.

Indexes:
- `kb_file_objects(organization_id, document_id)`.
- Unique optional: `(storage_provider, bucket, object_key)`.

Replaces: filesystem upload paths under `KNOWLEDGE_DATA_DIR`.

Migration notes: use object storage or durable mounted storage; do not store large raw files in Postgres unless a future decision explicitly accepts that cost.

## Audit Tables

### `audit_log`

Purpose: immutable system-wide audit trail.

Columns: `id`, `organization_id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `result`, `request_id`, `ip_hash`, `metadata jsonb`, `created_at`.

Indexes:
- `audit_log(organization_id, created_at desc)`.
- `audit_log(organization_id, resource_type, resource_id)`.
- `audit_log(actor_user_id, created_at desc)`.

Rules: append-only. Do not store raw request bodies, secrets, bearer tokens, API keys, or provider payloads.

### `admin_action_log`

Purpose: focused admin/accountability events.

Columns: `id`, `organization_id`, `actor_user_id`, `target_user_id`, `action`, `before jsonb`, `after jsonb`, `created_at`.

Indexes:
- `admin_action_log(organization_id, created_at desc)`.
- `admin_action_log(actor_user_id, created_at desc)`.

Replaces: scattered admin mutations without durable audit.

### `integration_health_log`

Purpose: historical integration health and sync diagnostics.

Columns: `id`, `organization_id`, `integration_profile_id`, `provider`, `status`, `checked_at`, `latency_ms`, `error_code`, `safe_details jsonb`, `created_at`.

Indexes:
- `integration_health_log(organization_id, provider, checked_at desc)`.

### `error_log`

Purpose: durable Error Center records.

Columns: `id`, `organization_id`, `timestamp`, `severity`, `status`, `source`, `page`, `module`, `endpoint`, `http_status`, `error_code`, `message`, `stack_trace`, `user_facing_message`, `technical_details`, `request_id`, `related_lead_id`, `related_customer_id`, `suggested_fix`, `likely_cause`, `raw_metadata jsonb`, `deployment jsonb`, `timeline jsonb`, `ai_analysis jsonb`, `first_seen_at`, `last_seen_at`, `occurrence_count`, `archived`, `dedup_key`, `created_at`, `updated_at`.

Indexes:
- `error_log(organization_id, created_at desc)`.
- `error_log(organization_id, severity, status)`.
- `error_log(dedup_key)`.
- `error_log(endpoint, created_at desc)`.

Replaces: `crm-error-log.json`.

Migration notes: preserve dedupe keys and timeline history. Stack traces should remain server-side only.

## Index Strategy

Required initial indexes:

- `leads(organization_id)`
- `leads(organization_id, status)`
- `leads(organization_id, created_at desc)`
- `leads(organization_id, updated_at desc)`
- `lead_contacts(organization_id, type, normalized_value)`
- `lead_sheet_mappings(spreadsheet_id, sheet_name, row_number)`
- `lead_ownership(organization_id, owner_user_id)`
- `conversations(organization_id, lead_id)`
- `conversations(organization_id, last_activity_at desc)`
- `conversation_messages(organization_id, conversation_id, created_at)`
- `conversation_messages(organization_id, created_at desc)`
- `replies_read_state(conversation_id, user_id)`
- `followups(organization_id, status, due_at)`
- `followups(organization_id, owner_user_id, due_at)`
- `dashboard_activity(organization_id, created_at desc)`
- `integration_sync_jobs(organization_id, status, next_run_at)`
- `ai_usage_logs(timestamp desc)`
- `ai_usage_logs(feature, timestamp desc)`
- `ai_usage_logs(provider, timestamp desc)`
- `error_log(organization_id, created_at desc)`
- `error_log(organization_id, severity, status)`
- `kb_documents(organization_id, status)`
- `kb_chunks(organization_id, document_id)`
- `kb_embeddings(chunk_id)`
- pgvector index on `kb_embeddings.embedding` if pgvector is enabled.

## Data Migration Strategy

1. Google Sheets leads -> `leads`, `lead_contacts`, `lead_sheet_mappings`.
   - Import each sheet row into a stable `lead_id`.
   - Store the sheet location in `lead_sheet_mappings`.
   - Validate row counts, status counts, and normalized contact counts.

2. `lead-ownership.json` -> `lead_ownership`.
   - Resolve each row number through `lead_sheet_mappings`.
   - Default unmapped/unowned rows to AH/admin only for compatibility.

3. `conversation-messages.json` -> `conversations`, `conversation_messages`, `replies_read_state`.
   - Create stable conversations per row/thread.
   - Preserve read cursors in `replies_read_state.metadata` until all message ids are stable.

4. `internal-tenancy.json` -> `organizations`, `users`.
   - Preserve AH admin user and Green Shield organization ids if possible.

5. `organization-integrations.json` -> `integration_profiles`.
   - Seed AH profile from the current file/env mirror.

6. `ai-usage-log.json` -> `ai_usage_logs`.
   - Import only sanitized metadata and operational fields.

7. `crm-error-log.json` -> `error_log`.
   - Preserve dedupe keys, occurrence counts, timeline, deployment metadata, and AI analysis.

8. Knowledge Base JSON/files -> `kb_documents`, `kb_chunks`, `kb_embeddings`, `kb_file_objects`.
   - Back up files first.
   - Keep original uploads in durable object storage or persistent disk references.

9. `training-items.json` and `sales-coach-sessions.json` -> future AI/training support tables.
   - Do not block core CRM DB migration on prompt/session history.

10. Objection feedback and embeddings -> AI/KB support tables.
    - Preserve cases and compare retrieval quality before switching reads.

## Dual-Write Strategy

Recommended order:

1. Append-only logs:
   - `ai_usage_logs`
   - `error_log`
   - `dashboard_activity`

2. Admin metadata:
   - `organizations`
   - `users`
   - `integration_profiles`

3. Lead ownership:
   - `lead_ownership`

4. Conversations/messages:
   - `conversations`
   - `conversation_messages`
   - `replies_read_state`

5. Live leads:
   - `leads`
   - `lead_contacts`
   - `lead_sheet_mappings`

Live leads come later because they are the highest-risk path. They drive dashboards, replies, follow-ups, AI context, agreements, and route workflows. They also require the strongest reconciliation between Sheets and Postgres before reads can switch.

## Feature Flag Strategy

Do not implement these in Stage 27. Future migration stages should introduce flags similar to:

- `DB_WRITE_AI_USAGE_ENABLED`
- `DB_READ_AI_USAGE_ENABLED`
- `DB_WRITE_ERROR_LOG_ENABLED`
- `DB_READ_ERROR_LOG_ENABLED`
- `DB_WRITE_USERS_ENABLED`
- `DB_READ_USERS_ENABLED`
- `DB_WRITE_INTEGRATIONS_ENABLED`
- `DB_READ_INTEGRATIONS_ENABLED`
- `DB_WRITE_LEAD_OWNERSHIP_ENABLED`
- `DB_READ_LEAD_OWNERSHIP_ENABLED`
- `DB_WRITE_LEADS_ENABLED`
- `DB_READ_LEADS_ENABLED`
- `DB_WRITE_CONVERSATIONS_ENABLED`
- `DB_READ_CONVERSATIONS_ENABLED`
- `DB_WRITE_KB_ENABLED`
- `DB_READ_KB_ENABLED`

Each read flag must be reversible. Each write flag should record dual-write failures without silently corrupting production state.

## Rollback Strategy

- Keep Sheets and JSON stores as the production source of truth until each read flag is explicitly enabled.
- Dual-write failure should alert and record an operational error. It should not break current production workflows for low-risk logs and metadata.
- For critical paths, define per-domain behavior before enabling DB writes: fail closed for security-critical records, fail open with alert for observability-only records.
- Build reconciliation reports before every read switch.
- Keep old stores untouched during backfills.
- Take backups before every import.
- Make every backfill idempotent.
- Do not delete or truncate old production stores until backups and restore drills have passed.

## Future Testing Strategy

Future implementation should include:

- Schema migration tests.
- Repository contract tests for JSON/Sheets/Postgres adapters.
- Backfill idempotency tests.
- Reconciliation tests for Sheets vs Postgres.
- `row_number` to `lead_id` mapping tests.
- Lead/contact dedupe tests.
- Permission scoping tests by organization/user/role.
- Conversation/read-state migration tests.
- AI/error log sensitive-data exclusion tests.
- KB retrieval equivalence tests before and after vector migration.
- Load tests for dashboard, replies, lead search, KB search, and sync jobs.
- Rollback tests for each read flag.

## Highest-Priority Implementation Tables

Stage 28 should not implement all tables at once. The safest first targets are:

1. `ai_usage_logs` and `error_log` because they are append-oriented and already have sanitized JSON stores.
2. `organizations`, `users`, and `integration_profiles` because they are small, admin-controlled metadata.
3. `lead_ownership` because the current JSON sidecar is explicitly temporary and already abstracted.
4. `conversations`, `conversation_messages`, and `replies_read_state` because they remove row-number keyed thread state.
5. `leads`, `lead_contacts`, and `lead_sheet_mappings` after reconciliation tooling is ready.

