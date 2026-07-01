# Append-only Postgres Enablement Runbook

This runbook documents the controlled, **read-only-validated** enablement of
append-only Postgres logging for two — and only two — domains:

1. AI usage logs
2. Error Center logs

It is the authoritative checklist for moving these two write paths from JSON
files to Postgres without affecting any other CRM data.

## 1. Purpose

Stages 28–33 prepared the infrastructure:

- DB tooling and migration runner.
- Repository contracts and current-store (JSON) adapters.
- Append-only Postgres tables, Postgres adapters, dual-write wrappers, and
  feature flags.
- Backfill and reconciliation tooling.
- AI usage runtime wired through `AIUsageRecorder`.
- Error Center runtime wired through `errorLogRecorder`.

Stage 34 adds a single safety gate — the validation script — and this runbook,
so that turning on DB writes is a deliberate, observable, reversible act.

**Explicit scope: append-only logs only.** Lead, conversation, user, integration,
and lead-ownership data are **out of scope** for this runbook and for the
enablement it describes.

## 2. Preconditions

Before starting, confirm:

- `DATABASE_URL` is configured in the target environment (Render, staging,
  local — wherever you are enabling writes).
- `DATABASE_SSL` is set appropriately for the host (`true` for Render-managed
  Postgres; `no-verify` only for trusted internal hosts where the cert chain
  is intentionally not validated).
- The current JSON/file stores for AI usage and Error Center are intact and
  recently backed up — they remain the source of truth until a future stage
  explicitly cuts reads over to Postgres.
- The append-only migrations exist on the branch you are deploying
  (`001_create_schema_migrations.sql`, `002_create_append_only_log_tables.sql`).
- You can roll back env-var changes from the same shell or admin console.

## 3. Validation command

Run the read-only validator first. It performs no DB writes, applies no
migrations, runs no backfill, and never enables a flag:

```
npm run db:validate:append-only --prefix server
```

The validator reports `pass | warn | fail` for each of:

- `database_configured` — `DATABASE_URL` present and parseable.
- `database_health` — passive connectivity probe.
- `migration_files_present` — required SQL files exist on disk.
- `migration_status` — required migrations are applied (DB only).
- `feature_flags` — current flag state is safe.
- `backfill_tooling_present` — required scripts exist.
- `documentation_present` — this runbook + dual-write docs exist.

For machine-readable output (e.g. for CI):

```
npm run db:validate:append-only --prefix server -- --json
```

The script exits `1` on a top-level `fail`, and `0` on `pass` or `warn`. Treat
any warning as a blocking signal to investigate before continuing.

## 4. Safe enablement sequence

Run each command in order. Do not skip steps. Do not run them concurrently.

```
npm run db:migrate:status --prefix server
npm run db:migrate --prefix server
npm run db:backfill:append-only --prefix server -- --domain=all
npm run db:backfill:append-only --prefix server -- --domain=all --apply
npm run db:reconcile:append-only --prefix server -- --domain=all
npm run db:reconcile:append-only --prefix server -- --domain=all --strict
```

The first backfill invocation runs as a dry run by default and prints a
summary. Only the second invocation, with `--apply`, performs writes — and only
to the append-only tables.

The strict reconciliation MUST exit successfully before continuing. If it
fails, stop and investigate. Do not enable write flags.

## 5. Enable write flags (only after every command above succeeds)

Set the following in the target environment, in the same change window:

```
DB_WRITE_AI_USAGE_ENABLED=true
DB_WRITE_ERROR_LOG_ENABLED=true
```

These flags activate dual-write: the runtime continues to write JSON files
**and** now also writes to the append-only Postgres tables. Reads remain on
JSON.

## 6. Keep read flags OFF

Do not change either of these in this stage:

```
DB_READ_AI_USAGE_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

Cutting reads over to Postgres is a separate decision and a future stage. The
JSON stores remain the source of truth until that happens.

## 7. Rollback

If anything looks wrong (latency, error rate, reconciliation drift), revert in
this exact order:

```
DB_WRITE_AI_USAGE_ENABLED=false
DB_WRITE_ERROR_LOG_ENABLED=false
DB_READ_AI_USAGE_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

The runtime falls back to JSON-only behavior immediately. The append-only
tables are left in place and can be inspected; nothing is destroyed by the
rollback.

## 8. Pre-flight report (opt-in evidence artifact)

The validator can optionally persist its result as a sanitized JSON file. This
is **opt-in only** — without the flag, nothing is written to disk.

Write a human-readable summary to stdout and persist the report:

```
npm run db:validate:append-only --prefix server -- --write-report=./reports/append-only-validation.json
```

Emit JSON to stdout **and** persist the report (stdout JSON gains a
`reportPath` field so it stays parseable):

```
npm run db:validate:append-only --prefix server -- --json --write-report=./reports/append-only-validation.json
```

Parent directories are created as needed. If the path already exists, it is
overwritten with the latest result.

**What the report is for**

- Attach to deployment/change-management notes as evidence that validation was
  run.
- Prove the environment was ready before any `DB_WRITE_*` flag was enabled.
- Keep as staging/prod history for later audit.

**What the report must not — and does not — contain**

- `DATABASE_URL` or any credentials
- secrets, API keys, bearer tokens, cookies
- raw customer data, raw AI prompts, or raw Error Center contents
- `process.env` snapshots
- absolute database file paths

The report is built from the same sanitized validation result already printed
to stdout. A defense-in-depth pass also strips any unexpected key whose name
matches `databaseurl`, `password`, `token`, `secret`, `cookie`, `bearer`,
`apikey`/`api_key`, or `authorization`.

**The report still does not enable anything**

Writing a report has the same non-effects as the validator itself:
no flags are mutated, no migrations are applied, no backfill is run,
no reads are switched to Postgres. The report is evidence, not action.

## 9. CI/Staging validation gate

The validator can run automatically against a disposable Postgres in
GitHub Actions, and the same sequence can be reproduced locally against a
staging Postgres.

### What the gate checks

- Migrations apply cleanly to a fresh database (`db:migrate`).
- The validator reports `pass` (or, at worst, `warn`) on the CI database.
- All four `DB_WRITE_*` and `DB_READ_*` flags are still OFF at the end of
  the run (the workflow pins them to `'false'` at the job env level).
- The append-only repository, DB tooling, AI usage, and Error Center
  recorder tests all pass against the migrated CI database.
- A sanitized JSON report is produced and uploaded as a workflow artifact.

### What the gate must not do

- **Never** enables `DB_WRITE_AI_USAGE_ENABLED`, `DB_WRITE_ERROR_LOG_ENABLED`,
  `DB_READ_AI_USAGE_ENABLED`, or `DB_READ_ERROR_LOG_ENABLED`.
- **Never** runs `--apply` backfill — only the dry-run shape is exercised by
  the validator's read-only checks.
- **Never** reads or modifies production data, production secrets, or the
  production Postgres. The workflow uses a disposable
  `postgres:16` service container scoped to the job.
- **Never** switches reads to Postgres. The runtime continues to read from
  the JSON/file stores regardless of CI outcome.
- Production enablement still requires the manual sequence in section 4 plus
  human approval. CI passing only certifies that the migration set and
  validator agree on a clean database.

### GitHub Actions workflow

The workflow lives at:

```
.github/workflows/append-only-db-validation.yml
```

It triggers on pull requests that touch:

- `server/migrations/**`
- `server/services/db/**`
- `server/repositories/**`
- `server/scripts/*append-only*`
- `server/scripts/validate-append-only-db-enablement.mjs`
- `server/scripts/run-append-only-validation-ci.mjs`
- `server/services/ai/AIUsageLogService.js`
- `server/services/errorLogService.js`
- `docs/*append-only*`
- `docs/postgres-migration-tooling.md`
- the workflow file itself

It can also be triggered manually via `workflow_dispatch`.

### Report artifact

The workflow writes the sanitized report to `reports/append-only-validation-ci.json`
inside the runner workspace and uploads it as a workflow artifact named
`append-only-validation-report` (retained for 30 days). The repository's
`.gitignore` excludes `reports/` and `server/reports/` so generated artifacts
are never committed.

### Running the same gate locally against staging

For a real staging Postgres, run the equivalent commands against
`DATABASE_URL` pointed at that environment:

```
npm run db:migrate:status --prefix server
npm run db:migrate --prefix server
npm run db:validate:append-only --prefix server -- --json --write-report=./reports/append-only-validation-staging.json
```

Or wrap them in the bundled fallback script, which:

- only applies migrations when `--migrate` is passed (default: inspect only),
- writes a sanitized JSON report to `--report=<path>`,
- exits `1` on validation failure or report-write failure.

```
DATABASE_URL=postgres://... \
  node server/scripts/run-append-only-validation-ci.mjs --migrate --report=./reports/append-only-validation-staging.json
```

Or via the bundled npm script:

```
npm run db:validate:append-only:ci --prefix server -- --migrate --report=./reports/append-only-validation-staging.json
```

Even when the CI/staging gate is green:

- `DB_WRITE_AI_USAGE_ENABLED` stays `false` until section 5 is performed.
- `DB_READ_AI_USAGE_ENABLED` stays `false`.
- `DB_WRITE_ERROR_LOG_ENABLED` stays `false` until section 5 is performed.
- `DB_READ_ERROR_LOG_ENABLED` stays `false`.
- Live CRM data is untouched. JSON/file stores remain the source of truth.
- Production enablement still requires the manual operator sequence in
  section 4 followed by the section 5 write-flag changes.

### Staging baseline evidence capture

When you are ready to certify that a real Postgres environment can host the
append-only logs, capture an evidence baseline by running the workflow (or its
local equivalent) and archiving the sanitized report.

**1. Trigger the GitHub Actions workflow manually**

- Open the repository on GitHub and go to **Actions**.
- Select the workflow named **append-only-db-validation**.
- Click **Run workflow** (the `workflow_dispatch` button) on the branch you
  want to certify.
- Wait for the run to finish. Confirm every step is green, especially
  *Run append-only DB enablement validator with sanitized report* and
  *Upload sanitized validation report*.

**2. Download the artifact**

- On the completed workflow run page, scroll to **Artifacts**.
- Download **append-only-validation-report** (a zip of
  `reports/append-only-validation-ci.json`).
- Open `append-only-validation-ci.json` and confirm:
  - `status` is `pass`
  - `warningCount` is `0`
  - `failureCount` is `0`
  - every entry under `safeSummary` matches the example below
    (`databaseConfigured: true`, `writeFlagsEnabled: false`,
    `readFlagsEnabled: false`)
  - no `DATABASE_URL` credentials are present
  - no API keys, bearer tokens, cookies, or other secrets are present
  - no raw AI prompts, customer messages, or Error Center records are present

**3. Run the same validation against a real staging Postgres locally**

If you also want to certify a real staging Postgres (e.g. a Render staging
instance, a managed Postgres outside CI), point `DATABASE_URL` at it and run:

```
DATABASE_URL=postgres://... \
  npm run db:validate:append-only:ci --prefix server -- \
    --migrate \
    --report=./reports/append-only-validation-staging.json
```

The script applies pending migrations to that target only when `--migrate` is
passed, then writes the sanitized report. The `reports/` directory is already
git-ignored (Stage 36), so the staging report stays local unless you choose to
archive it externally.

**4. What to inspect in any report**

- `status` — must be `pass` to certify readiness.
- `checks` — every check should be `pass`. A `warn` is acceptable for
  in-repo development storage but not for production-equivalent staging.
- `safeSummary` — confirm `writeFlagsEnabled: false` and
  `readFlagsEnabled: false`. If either is true, the target environment has
  already started flag enablement and is no longer a baseline.
- `recommendedCommands` — the safe sequence the validator wants you to run.
  Does not change between baselines.
- absence of secrets, raw logs, customer data, or real production hostnames.

**5. What this evidence does NOT authorize**

Capturing a clean baseline confirms that the migration set, validator, and
disposable database agree. It does **not** authorize:

- enabling `DB_WRITE_AI_USAGE_ENABLED` or `DB_WRITE_ERROR_LOG_ENABLED` in
  production
- enabling either `DB_READ_*` flag in production
- switching reads to Postgres
- lead, conversation, user, integration, or any other domain migration
- running `--apply` backfill against production data
- any change to live CRM data

Production enablement still requires the manual sequence in section 4 plus
human approval. The runbook's section 7 rollback remains the authoritative way
to disable any flag that was turned on.

**6. Where the example baseline lives**

A sanitized example of a clean pass result is committed at:

```
docs/examples/append-only-validation-baseline.example.json
```

Use it as a reference shape for comparison. It uses placeholder host
`db.example.invalid` (RFC 6761 reserved, non-resolvable) and contains no
credentials, no secrets, and no production data. It must never be replaced
with a real generated report — the workflow artifact and the `reports/`
directory are the right places for those.

### Admin validation endpoint

Admins can request the same sanitized validation result through a backend
route, without invoking the CLI:

```
GET /api/admin/db/append-only/validation
```

Rules:

- Gated by `requireAdmin` (same middleware that protects `/api/admin/users`
  and `/api/ai/health`/`/api/ai/usage`). Non-admin users receive
  `403 ADMIN_REQUIRED`; missing context returns `401 AUTH_REQUIRED`.
- **Read-only.** No flag mutation, no migrations, no backfill, no report file
  is written from this route. Use the CLI (`db:validate:append-only`) for
  on-disk reports.
- Response shape:

```
{
  "source": "append_only_db_enablement_validation",
  "generatedAt": "...",
  "cache": { "cached": false, "cacheTtlSeconds": 30, "cachedAt": "..." },
  "validation": {
    "status": "pass | warn | fail",
    "checks": [...],
    "recommendedCommands": [...]
  }
}
```

- A small in-memory cache holds the validation result for 30 seconds so a
  refresh storm from an admin UI cannot hammer the validator. Pass
  `?refresh=true` to bypass the cache for that single request. The cache is
  process-local and is cleared when the server restarts.
- The route never returns `DATABASE_URL`, credentials, API keys, bearer
  tokens, cookies, raw AI prompts, raw Error Center records, or raw env
  values. It surfaces the same sanitized output that the CLI produces.

Intended for a future admin UI readiness banner. **This stage does not add
that UI.** No flag toggle endpoint, no `?apply=true`, no write side — by
design.

### Admin UI readiness banner

The admin validation route also powers a read-only banner on the existing
**AI Observability** admin page (`/admin/ai-observability`).

- **Where it appears.** Above the existing "Usage log storage" section,
  immediately under the page header. Only admins see the banner — the page
  is gated by `isAdminAuthStatus()` client-side on top of the route's
  `requireAdmin` backend gate.
- **What pass/warn/fail means.**
  - `pass` → green pill, summary "DB readiness: pass — 0 fail / 0 warn",
    reminder: *Safe to continue staging validation. Production write flags
    still require manual approval.*
  - `warn` → amber pill, summary includes the actual warning count,
    reminder: *Warnings found. Do not enable production write flags until
    reviewed.*
  - `fail` → red pill, summary includes the actual failure count, reminder:
    *Do not enable DB write flags. Fix failed checks first.*
  - `loading` and `error` are neutral / red respectively and never imply
    readiness.
- **Refresh behavior.** A single Refresh button calls the admin route with
  `?refresh=true`, bypassing the 30 s backend cache exactly once. If the
  refresh request fails the previous result is preserved and a small inline
  notice explains the failure — the page never loses context or crashes.
- **Read-only — by design.** The banner has **no** flag toggle button, **no**
  migration trigger, **no** backfill trigger, **no** report-download button.
  The only action available is Refresh. The client API namespace
  `api.adminDbAppendOnly` is intentionally narrow: only `validation()` is
  exposed.
- **No production enablement.** The banner showing `pass` does **not**
  authorize enabling `DB_WRITE_AI_USAGE_ENABLED` or
  `DB_WRITE_ERROR_LOG_ENABLED` in production. It does **not** switch reads to
  Postgres. It does **not** apply migrations or run backfill. Production
  enablement still requires the manual operator sequence in section 4 plus
  the section 5 write-flag changes.

### CLI strictness flags (optional)

The base validator CLI also accepts two optional thresholds for CI on
protected branches that should not tolerate any warnings:

```
--max-failure-count=<n>
--max-warning-count=<n>
```

When set, the CLI exits `1` if the actual failure or warning count exceeds
the threshold. **Default behavior is unchanged.** Without these flags, only
`status: 'fail'` produces exit `1`.

Common patterns:

```
npm run db:validate:append-only --prefix server -- --json --max-warning-count=0
```

```
npm run db:validate:append-only --prefix server -- \
  --json \
  --write-report=./reports/append-only-validation-ci.json \
  --max-warning-count=0 \
  --max-failure-count=0
```

Rules:

- Invalid threshold values (non-numeric, negative, empty) fail safely with a
  clear error and exit `1`. They never run validation when the parse fails.
- `--write-report` still writes the file even if thresholds are violated, so
  CI artifacts remain available for postmortem.
- `--json` output gains a `thresholds` block (counts + violations) only when
  at least one threshold flag is set — default JSON output is unchanged.
- Strictness lives only in the base validator CLI for now. The fallback
  `run-append-only-validation-ci.mjs` does not parse these flags; if CI on
  protected branches needs them, invoke `db:validate:append-only` directly.

Reminders, even when an admin can see the validator output through the API or
when CI runs with strict thresholds:

- `DB_WRITE_AI_USAGE_ENABLED` stays `false` until section 5 is performed.
- `DB_WRITE_ERROR_LOG_ENABLED` stays `false` until section 5 is performed.
- `DB_READ_AI_USAGE_ENABLED` and `DB_READ_ERROR_LOG_ENABLED` stay `false`.
- Live CRM data is untouched.
- JSON/file stores remain the source of truth.
- Production enablement still requires the manual operator sequence in
  section 4 plus the section 5 write-flag changes, regardless of how green
  the admin endpoint or strict-mode CI look.

### Staging-only dual-write exercise

Before flipping `DB_WRITE_*` in production (section 5), prove that the
recorder → dual-write → Postgres-adapter chain actually persists records
end-to-end against a staging Postgres. The exercise uses **synthetic data
only** — no real AI provider calls, no Gmail/Twilio, no customer data.

**Command**

```
DATABASE_URL=postgres://<staging-credentials> \
  npm run db:exercise:append-only:staging --prefix server -- \
    --confirm-staging
```

Optionally write a sanitized JSON report (opt-in, never on by default):

```
DATABASE_URL=postgres://<staging-credentials> \
  npm run db:exercise:append-only:staging --prefix server -- \
    --confirm-staging \
    --write-report=./reports/append-only-dual-write-staging.json
```

**Required gates** (the script refuses to run if any fails):

- `--confirm-staging` must be on the command line.
- `NODE_ENV` must not be `production`.
- `DATABASE_URL` must be set and must point at a **staging** Postgres.
- `DB_READ_AI_USAGE_ENABLED` must be `false` (or unset).
- `DB_READ_ERROR_LOG_ENABLED` must be `false` (or unset).

**Write-flag handling**

The script flips `DB_WRITE_AI_USAGE_ENABLED=true` and
`DB_WRITE_ERROR_LOG_ENABLED=true` **inside this process only** for the
duration of the exercise. It never writes to `.env`, never mutates
`process.env`, never persists flag changes to deployment config, and never
touches production. Both read flags stay `false` for the entire exercise.

**Synthetic data only**

- AI usage entry: `feature: 'stage40_staging_dual_write_exercise'`,
  `provider: 'synthetic'`, `model: 'synthetic-validation-model'`,
  `metadata: { exercise: true, stage: 40, environment: 'staging', synthetic: true }`.
- Error Center entry: `source: 'backend'` (the only allow-listed value),
  `module: 'stage40_staging_dual_write_exercise'`,
  `errorCode: 'STAGE40_STAGING_DUAL_WRITE_EXERCISE'`, `severity: 'low'`,
  `rawMetadata: { exercise: true, stage: 40, environment: 'staging', synthetic: true }`.
- No real AI providers, no Gmail, no Twilio, no customer data, no real
  stack traces are touched. The script source has no provider SDK imports.

**Verification**

For each synthetic event, the script confirms:

1. The current JSON/file store wrote the record (returns the persisted record).
2. The Postgres dual-write wrote the same record (`listUsage({ feature: SYNTHETIC_FEATURE })`
   for AI usage, `getErrorById(id)` for Error Center).
3. `process.env` was not mutated by the run.

**Expected pass output**

```
{
  "status": "pass",
  "environment": "staging",
  "exercise": "append_only_dual_write_staging",
  "writeFlagsUsed": {
    "dbWriteAIUsageEnabled": true,
    "dbWriteErrorLogEnabled": true,
    "dbReadAIUsageEnabled": false,
    "dbReadErrorLogEnabled": false
  },
  "aiUsage": { "currentStoreWritten": true, "postgresWritten": true, "syntheticOnly": true },
  "errorLog": { "currentStoreWritten": true, "postgresWritten": true, "syntheticOnly": true }
}
```

Exit code `0` on pass. Exit code `1` on any safety-gate refusal, any
`postgresWritten: false`, any `currentStoreWritten: false`, or any
`process.env` mutation.

**If it fails**

- Run `db:migrate:status --prefix server` against the same `DATABASE_URL` to
  confirm migrations 001 + 002 are applied to the staging database.
- Re-run `db:validate:append-only --prefix server -- --json` to confirm the
  validator agrees on readiness.
- Check the script's printed summary for the specific Postgres adapter
  error code.
- Do **not** retry against production. Do **not** flip flags. Investigate
  on staging first.

**Synthetic record cleanup**

The exercise intentionally **leaves the synthetic rows in both stores** —
they are audit evidence that the dual-write succeeded. Each row is
discoverable by `feature: 'stage40_staging_dual_write_exercise'` (AI usage)
or `errorCode: 'STAGE40_STAGING_DUAL_WRITE_EXERCISE'` (Error Center). The
script does not delete them and does not expose a default cleanup mode.

**This exercise still does not authorize production enablement**

A clean staging pass is *evidence* that the migration set + dual-write code
work against a real Postgres. It is **not** authorization to flip
`DB_WRITE_AI_USAGE_ENABLED` or `DB_WRITE_ERROR_LOG_ENABLED` in production.
Production enablement still requires the manual operator sequence in
section 4, the section 5 write-flag changes, and human approval. Read flags
stay `false`. JSON/file stores remain the source of truth.

### Staging burn-in validation (Stage 41)

Stage 41 is a **controlled staging burn-in**: the staging backend runs
normally with Postgres write flags ON while read flags remain OFF, so the
current JSON/file stores stay the source of truth and Postgres receives
duplicate append-only writes in the background. After a short burn-in
window, the read-only Stage 41 validator confirms that shadow writes are
actually landing.

**Render staging environment variables**

Set these on the staging backend service only. Do **not** set them on
production.

```
DATABASE_URL=<staging Postgres URL — internal preferred>
DATABASE_SSL=true
DB_WRITE_AI_USAGE_ENABLED=true
DB_WRITE_ERROR_LOG_ENABLED=true
DB_READ_AI_USAGE_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

Redeploy staging so the recorder singletons re-read the environment at
module load. See the *Recorder singletons capture env at module load*
guidance — scripts and long-running processes that already imported the
recorders must be restarted; a config-only redeploy is sufficient.

**Burn-in procedure**

1. Confirm staging is running with the flags above.
2. Use the staging app normally for a short burn-in window (30–60 minutes
   is typical). Do not point real customers at staging. Do not send Gmail
   or Twilio to real recipients.
3. If a safe staging AI action is available, trigger it once so at least
   one AI usage row lands.
4. If safe Error Center test tooling already exists, trigger one synthetic
   error. Do not fabricate an error path for the purpose of this validation.
5. Run the Stage 41 validator (locally or on staging) with the same
   `DATABASE_URL`:

```
DATABASE_URL=<staging Postgres URL> \
DATABASE_SSL=true \
DB_WRITE_AI_USAGE_ENABLED=true \
DB_WRITE_ERROR_LOG_ENABLED=true \
DB_READ_AI_USAGE_ENABLED=false \
DB_READ_ERROR_LOG_ENABLED=false \
NODE_ENV=staging \
npm run db:validate:append-only:burn-in:staging --prefix server -- \
  --since-minutes=60 \
  --write-report=./reports/append-only-burn-in-staging.json
```

6. Confirm the summary reports `status: "pass"` (or `warn` if activity was
   sparse) with `postgresWritten` evidence for both domains, no
   `flags_read_*_off: fail`, and `env_node_env_not_production: pass`.
7. Save the report file as burn-in evidence.
8. Keep read flags OFF.

**Validation checks**

The validator confirms each of the following. All are read-only.

- `env_node_env_not_production` — `NODE_ENV` must not be `production`.
- `env_database_url_configured` — `DATABASE_URL` must be set.
- `env_database_ssl_supported` — `DATABASE_SSL` value parses (`true`,
  `false`, `no-verify`, `allow-unauthorized`, or empty).
- `flags_read_ai_usage_off` / `flags_read_error_log_off` — must be OFF.
- `flags_write_ai_usage_on_for_burn_in` / `flags_write_error_log_on_for_burn_in`
  — must be ON during burn-in.
- `env_no_production_indicators` — warns if the `DATABASE_URL` host
  contains `prod`, `production`, or `live`.
- `db_reachable` — passive `select 1` succeeds.
- `db_migrations_applied` — no pending migrations.
- `db_ai_usage_table_present` / `db_error_log_table_present` — the
  append-only tables exist.
- `db_ai_usage_recent_rows` / `db_error_log_recent_rows` — recent rows in
  the `--since-minutes` window; **warn** (not fail) when zero, because a
  quiet staging period is not itself a failure.
- `current_store_ai_usage_readable` / `current_store_error_log_readable` —
  JSON/file stores still read cleanly.

**Rollback**

If anything looks wrong on staging, set the flags back to OFF and redeploy
staging:

```
DB_WRITE_AI_USAGE_ENABLED=false
DB_WRITE_ERROR_LOG_ENABLED=false
DB_READ_AI_USAGE_ENABLED=false
DB_READ_ERROR_LOG_ENABLED=false
```

No data is lost — JSON/file stores were the source of truth throughout the
burn-in. The append-only rows already written to staging Postgres are
harmless append-only audit rows and do not need to be deleted.

**Sanitized report**

The `--write-report` output contains no `DATABASE_URL`, no credentials, no
raw env, and no stack traces. `err.message` values are truncated to 200
characters and stripped of `postgres://…`, `password…`, `Bearer …`, and
`sk-…` patterns. The report's `stage` field is
`stage41_append_only_burn_in_staging`.

**This burn-in still does not authorize production enablement**

A clean staging burn-in is *evidence* that shadow writes work end-to-end in
a real Postgres for an extended session, not a permission to flip
`DB_WRITE_AI_USAGE_ENABLED` or `DB_WRITE_ERROR_LOG_ENABLED` in production.
Production enablement still requires the manual operator sequence in
section 4, the section 5 write-flag changes, and human approval. Read flags
stay `false`. JSON/file stores remain the source of truth.

## 10. Explicit non-goals

This runbook is **not** authorization to:

- Migrate leads, lead ownership, lead history, conversation messages, customer
  data, users, organization integration profiles, knowledge-base data, sales
  coach sessions, training items, or any other domain.
- Switch reads to Postgres for AI usage or Error Center.
- Change any API response body, header, or status code (`Deprecation` headers
  added in Stage 23 are unrelated and unchanged).
- Modify AI behavior, prompts, models, provider wrappers, embedding logic,
  transcription logic, Gmail flow, or Twilio flow.
- Add or change any frontend UI.

If a future stage proposes any of those, it requires its own runbook and its
own validator. This document covers only the controlled enablement of
append-only writes for the two log domains above.
