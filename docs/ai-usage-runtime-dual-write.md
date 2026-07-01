# AI Usage Runtime Dual-Write

Stage 32 wires AI usage runtime recording through `AIUsageRecorder`. This stage targets AI usage logs only. Error Center runtime wiring is intentionally deferred.

## Scope

Included:

- AIExecutionEngine usage logging
- embedding provider usage logging
- transcription provider usage logging
- `/api/ai/usage` and `/api/ai/usage/storage` reads through the recorder boundary

Not included:

- Error Center runtime dual-write
- leads, conversations, users, integrations, or lead ownership
- prompt changes
- provider wrapper behavior changes
- API response body changes

## Default Behavior

The default flags are off:

```bash
DB_WRITE_AI_USAGE_ENABLED=false
DB_READ_AI_USAGE_ENABLED=false
```

With flags off, `AIUsageRecorder` calls `AIUsageLogService` directly. Postgres repositories are not constructed and Postgres is not touched.

Current JSON/file AI usage logs remain the source of truth.

## Write Behavior

With `DB_WRITE_AI_USAGE_ENABLED=true`:

1. AI usage is recorded to the current JSON/file store first.
2. The recorder attempts a Postgres write second.
3. A Postgres write failure logs a safe warning and does not break the AI request.

Safe failure code:

```text
DB_DUAL_WRITE_AI_USAGE_FAILED
```

No prompts, customer messages, transcripts, embeddings, raw provider responses, or secrets are written by the recorder.

## Read Behavior

With `DB_READ_AI_USAGE_ENABLED=false`, `/api/ai/usage` reads from the current JSON/file store.

With `DB_READ_AI_USAGE_ENABLED=true`, the recorder can read from the Postgres adapter. Do not enable this in production until backfill and reconciliation have passed.

## Backfill Requirement

Before enabling DB write flags in a real environment:

1. Run append-only migrations.
2. Run dry-run backfill.
3. Run apply backfill.
4. Run reconciliation.
5. Keep current JSON/file stores available for rollback.

See `docs/append-only-backfill-reconciliation.md`.

## Rollback

To roll back:

1. Disable `DB_WRITE_AI_USAGE_ENABLED`.
2. Disable `DB_READ_AI_USAGE_ENABLED`.
3. Leave JSON/file stores in place.
4. Continue reading current-store usage logs.

