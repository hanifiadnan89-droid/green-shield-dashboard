# Postgres Migration Tooling

Stage 28 adds database connection and migration tooling only. It does not switch any CRM reads or writes to Postgres, does not dual-write, does not migrate live data, and does not change Google Sheets, AI, Gmail, or Twilio behavior.

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Only for DB commands | Postgres connection string. Never log this value. |
| `DATABASE_SSL` | No | `false` for local development, `true` for verified TLS, `no-verify` only when the provider requires unauthenticated TLS. |
| `DATABASE_POOL_MAX` | No | Max pool size. Defaults to `5`. |
| `DATABASE_CONNECTION_TIMEOUT_MS` | No | Connection timeout. Defaults to `5000`. |

If `DATABASE_URL` is missing, DB health reports `disabled` and normal CRM runtime behavior is unchanged.

## Local Setup

Use any local Postgres instance. Example:

```bash
createdb green_shield_crm
export DATABASE_URL=postgres://localhost:5432/green_shield_crm
export DATABASE_SSL=false
npm run db:migrate:status --prefix server
npm run db:migrate --prefix server
```

The exact username/password depends on your local Postgres installation.

## Render / Production Setup

Create a managed Postgres database and set:

```bash
DATABASE_URL=<render postgres internal or external URL>
DATABASE_SSL=true
DATABASE_POOL_MAX=5
DATABASE_CONNECTION_TIMEOUT_MS=5000
```

Do not remove current Sheets/JSON configuration. Postgres is not the source of truth yet.

## Commands

```bash
npm run db:migrate:status --prefix server
npm run db:migrate --prefix server
```

`db:migrate:status` lists migration files as `pending` or `applied`.

`db:migrate` applies pending migrations in filename order and records them in `schema_migrations`.

## Migration Tracking

Applied migrations are tracked in:

```sql
schema_migrations (
  id bigserial primary key,
  name text not null unique,
  checksum text not null,
  applied_at timestamptz not null default now()
)
```

The runner calculates a SHA-256 checksum for each migration file. If an already-applied migration file changes, the runner fails with a checksum mismatch instead of silently continuing.

## Safety Rules

- Migrations do not run on server startup.
- Importing the server does not connect to Postgres.
- `DATABASE_URL` is optional unless a DB-specific command or health check is run.
- Do not log database credentials.
- Run migrations intentionally as an operational action.
- Keep Sheets/JSON stores as the production source of truth until future read/write flags are enabled.
- Add schema tables incrementally. Do not create the whole future CRM schema in one risky migration.

## Rollback Policy

Stage 28 has no production read/write dependency on Postgres, so rollback is simply:

1. Stop running DB commands.
2. Leave `DATABASE_URL` unset if DB tooling should be disabled.
3. Revert migration files only if they have not been applied anywhere shared.

Once future stages start dual-writing, rollback must follow the per-domain feature flag and reconciliation plan in `docs/postgres-schema-design.md`.

## Current Stage Boundary

This stage adds:

- `pg` dependency.
- Lazy DB pool creation.
- Safe DB config redaction.
- Passive DB health service.
- Migration file discovery/checksum/status/apply tooling.
- Initial `schema_migrations` migration.

This stage does not add:

- Postgres-backed repositories.
- Dual-write.
- DB-backed CRM reads.
- Live data backfill.
- Startup auto-migration.

