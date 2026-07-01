# Append-Only Dual-Write Plan

Stage 30 prepares low-risk append-only logs for future Postgres dual-write. It does not enable database writes by default, does not switch reads to Postgres, does not migrate live data, and does not change runtime behavior.

## Scope

Only these domains are included:

- AI usage logs
- Error Center logs

These were chosen first because they are operational logs, already sanitized, and lower risk than live CRM records.

## Tables Added

Migration `002_create_append_only_log_tables.sql` creates:

- `ai_usage_logs`
- `error_log`

These tables mirror the safe operational fields already persisted by the JSON/file-backed services. They must not store prompts, customer messages, raw request bodies, transcripts, embedding vectors, raw provider responses, API keys, cookies, bearer tokens, or secrets.

## Feature Flags

All flags default to false (`false`):

```bash
DB_WRITE_AI_USAGE_ENABLED=false
DB_READ_AI_USAGE_ENABLED=false
DB_WRITE_ERROR_LOG_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

Accepted true values are `true`, `1`, `on`, and `yes`.

With flags off:

- current JSON/file stores are called;
- Postgres adapters are not used;
- current stores remain the source of truth;
- production behavior is unchanged.

## Repository Adapters

Stage 30 adds:

- `aiUsagePostgresRepository`
- `errorLogPostgresRepository`
- `aiUsageDualWriteRepository`
- `errorLogDualWriteRepository`

Postgres adapters use parameterized SQL only.

Dual-write wrappers call the current-store repository first. If the DB write flag is enabled, they attempt the Postgres write second. If Postgres fails, they log a safe warning and return the current-store result.

## Read Behavior

Read flags exist for future cutover work. They default off.

If a read flag is enabled in tests or a future stage, the dual-write wrapper can route reads to the Postgres adapter. Production should not enable read flags until reconciliation proves the database copy is complete and correct.

## Why Leads Are Deferred

Leads remain in Google Sheets and are still identified by `row_number`. They drive dashboard metrics, replies, AI context, agreements, route workflows, and follow-up state. Dual-writing leads before stable `lead_id` backfill and reconciliation would create a high risk of mismatched customer records.

## Failure Behavior

Dual-write failure must not break current JSON/file writes.

Safe failure codes:

- `DB_DUAL_WRITE_AI_USAGE_FAILED`
- `DB_DUAL_WRITE_ERROR_LOG_FAILED`

Error Center dual-write failures should not recursively create Error Center records. Use safe internal warnings until a non-recursive diagnostic path exists.

## Next Stage

Stage 31 should add backfill/reconciliation tooling for append-only logs or introduce disabled dual-write wiring behind explicit flags. Do not move live CRM reads to Postgres until reconciliation and rollback controls are proven.
