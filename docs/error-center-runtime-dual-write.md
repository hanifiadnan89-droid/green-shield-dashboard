# Error Center Runtime Dual-Write

Stage 33 wires Error Center runtime logging through `errorLogRecorder`. This stage targets Error Center logs only. Leads, conversations, users, integrations, lead ownership, AI behavior, prompts, provider wrappers, Gmail, and Twilio are unchanged.

## Default Behavior

The default flags remain off:

```bash
DB_WRITE_ERROR_LOG_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

With flags off, `errorLogRecorder` calls `errorLogService` directly. Postgres repositories are not constructed, `dbClient` is not called, and current JSON/file Error Center logs remain the source of truth.

## Write Path

With `DB_WRITE_ERROR_LOG_ENABLED=true`:

1. `errorLogRecorder.createError()` writes to the current JSON/file store first.
2. If that succeeds, it queues a Postgres write through the existing Error Log dual-write repository.
3. The current-store result is returned to the caller.
4. If Postgres fails, the recorder emits a safe warning with `DB_DUAL_WRITE_ERROR_LOG_FAILED` and still returns the JSON/file result.

Postgres dual-write failure must not create another Error Center event. This avoids recursive Error Center logging when Error Center itself is the failing dual-write target.

Status updates, archive/resolve actions, and AI analysis write-back still update the current JSON/file store in this stage so route behavior and response shapes remain stable.

## Read Path

With `DB_READ_ERROR_LOG_ENABLED=false`, all Error Center reads come from the current JSON/file store.

With `DB_READ_ERROR_LOG_ENABLED=true`, read helpers may use the Postgres repository where implemented. This flag should remain off until a real backfill and reconciliation pass proves Postgres contains matching data.

## Backfill Requirement

Before enabling Error Center DB writes or reads in a real environment:

1. Run append-only backfill against a configured Postgres database.
2. Run reconciliation.
3. Confirm current-store and Postgres counts/checks pass.
4. Keep JSON/file logs as the source of truth until read flags are explicitly enabled.

## Rollback

Rollback is immediate:

```bash
DB_WRITE_ERROR_LOG_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

With both flags off, runtime behavior returns to direct JSON/file Error Center persistence. Do not delete JSON/file Error Center logs during this phase.
