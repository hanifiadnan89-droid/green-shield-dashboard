# Append-Only Backfill And Reconciliation

Stage 31 adds intentional backfill and reconciliation tooling for append-only logs only:

- AI usage logs
- Error Center logs

This does not enable runtime dual-write, does not switch reads to Postgres, does not migrate live CRM data, and does not change Google Sheets, AI, Gmail, or Twilio behavior. Current JSON/file stores remain the source of truth.

## What Backfill Does

Backfill reads the current JSON/file-backed repositories, transforms records through the existing Postgres repository adapters, and writes them to Postgres only when `--apply` is passed.

Dry-run is the default. Dry-run reads current stores and prints summary counts, but does not call Postgres write methods.

The backfill never mutates or deletes current JSON/file stores.

## What Reconciliation Compares

Reconciliation is read-only. It compares current stores and Postgres using safe operational checks:

- total count
- missing ids
- extra ids
- latest timestamp
- AI usage buckets by provider, feature, and success
- Error Center buckets by severity and status

It does not compare prompts, raw request bodies, customer messages, secrets, provider payloads, transcripts, or embeddings.

Missing and extra id samples are capped so reports remain safe and readable.

## Commands

Dry-run all append-only logs:

```bash
npm run db:backfill:append-only --prefix server -- --domain=all
```

Apply backfill:

```bash
npm run db:backfill:append-only --prefix server -- --domain=all --apply
```

Reconcile:

```bash
npm run db:reconcile:append-only --prefix server -- --domain=all
```

Strict reconciliation, returning nonzero on mismatch:

```bash
npm run db:reconcile:append-only --prefix server -- --domain=all --strict
```

Supported domains:

- `all`
- `ai_usage`
- `error_log`

Optional limit:

```bash
npm run db:backfill:append-only --prefix server -- --domain=ai_usage --limit=500
```

## DB Write Flags

Stage 31 does not enable DB write flags.

These remain off by default:

- `DB_WRITE_AI_USAGE_ENABLED`
- `DB_READ_AI_USAGE_ENABLED`
- `DB_WRITE_ERROR_LOG_ENABLED`
- `DB_READ_ERROR_LOG_ENABLED`

Backfill commands do not require these flags. They are intentional operational commands separate from runtime dual-write.

## Rollback

Because current JSON/file stores remain source of truth, rollback is straightforward:

1. Stop running backfill commands.
2. Leave DB write/read flags disabled.
3. Drop or truncate Postgres append-only log tables only if they are known not to be used by any environment.
4. Keep JSON/file stores untouched.

## Before Enabling Runtime DB Write Flags

Before enabling `DB_WRITE_AI_USAGE_ENABLED` or `DB_WRITE_ERROR_LOG_ENABLED`, require:

- migrations applied successfully;
- dry-run backfill reviewed;
- apply backfill completed;
- reconciliation passes;
- strict reconciliation passes if used in deployment checks;
- Postgres storage/backup plan confirmed;
- current stores remain available for rollback.

Stage 32 wires AI usage runtime recording through the recorder boundary, but the same rule applies: run backfill and reconciliation in a real Postgres-backed environment before enabling `DB_WRITE_AI_USAGE_ENABLED`.

Stage 33 wires Error Center runtime logging through the recorder boundary. Run backfill and reconciliation in a real Postgres-backed environment before enabling `DB_WRITE_ERROR_LOG_ENABLED`.
