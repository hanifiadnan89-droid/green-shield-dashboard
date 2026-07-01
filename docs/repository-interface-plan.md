# Repository Interface Plan

Stage 29 introduces repository contracts over current stores. This is an abstraction stage only. It does not switch runtime reads or writes to Postgres, does not dual-write, does not migrate live data, and does not change Google Sheets, AI, Gmail, or Twilio behavior.

## Purpose

The repository layer gives future Postgres adapters a clean target while preserving current production behavior. Current services continue to use the existing Sheets, JSON, and file-backed stores until later stages explicitly switch call sites behind feature flags.

The intended long-term shape is:

```text
Business service
  -> repository contract
  -> current-store adapter or future Postgres adapter
```

Stage 29 creates the contracts and current-store adapters, but does not move production services onto them yet.

## Wrapped In Stage 29

| Domain | Contract | Current-store adapter | Backing service |
| --- | --- | --- | --- |
| AI usage | `AIUsageRepository` | `aiUsageJsonRepository` | `AIUsageLogService.js` |
| Error Center | `ErrorLogRepository` | `errorLogJsonRepository` | `errorLogService.js` |
| Users and organizations | `UserRepository` | `userJsonRepository` | `organizationUsers.js` |
| Integration profiles | `IntegrationProfileRepository` | `integrationProfileJsonRepository` | `organizationIntegrations.js` |
| Lead ownership | `LeadOwnershipRepository` | `leadOwnershipJsonRepository` | `leadOwnership.js` / `leadOwnershipStore.js` |

These domains are the safest first targets because they already have service boundaries and are either append-oriented, admin metadata, or explicitly temporary compatibility stores.

## Deferred Domains

Live leads are deferred because Google Sheets remains the operational source of truth and `row_number` still drives updates, dashboard data, reply context, AI context, agreements, and route workflows.

Conversation messages are deferred because the current thread store is keyed by `row_number` and also updates sheet read-state. It should be migrated after the lead identity mapping is ready.

Knowledge Base storage is deferred because it involves files, chunks, embeddings, extraction jobs, and retrieval quality checks.

## Current-Store Adapters

Current-store adapters delegate to existing services. They do not duplicate JSON persistence, do not access Google Sheets directly, do not import `dbClient`, and do not import `pg`.

Examples:

- AI usage adapter calls `recordAIUsage`, `listAIUsage`, `summarizeAIUsage`, and safe storage status helpers.
- Error log adapter calls existing Error Center creation/list/status/timeline helpers.
- User adapter calls existing organization/user JSON helpers.
- Integration adapter calls existing profile helpers.
- Lead ownership adapter calls existing row-number-compatible ownership helpers.

## Future Postgres Adapters

Future stages can add Postgres adapters with the same contract methods, then swap individual repositories through the registry or explicit dependency injection.

No Postgres adapter exists in Stage 29.

## Repository Registry

`server/repositories/repositoryRegistry.js` returns current-store repositories by default and accepts overrides for tests or future adapters.

This keeps future dual-write work incremental. A later stage can create a repository that writes to both the current store and Postgres without changing every business service at once.

## Dual-Write Preparation

The repository layer prepares dual-write but does not perform it. A future dual-write adapter should:

- call the current-store adapter first while current stores remain source of truth;
- write the same sanitized data to the Postgres adapter;
- record dual-write failures safely;
- keep reads pointed at the current store until reconciliation passes;
- be controlled by per-domain feature flags.

## `row_number` Compatibility

Lead ownership still accepts `rowNumber` because live leads do not have `lead_id` yet. This is temporary compatibility metadata.

Future lead identity flow:

```text
row_number -> lead_sheet_mappings -> lead_id -> lead_ownership
```

Do not introduce `lead_id` behavior into lead ownership repositories until the backfill and mapping table exist.

## Runtime Behavior

Runtime behavior is unchanged in Stage 29:

- Existing services are not switched to repositories.
- Existing Google Sheets behavior is unchanged.
- Existing JSON/file stores remain source of truth.
- Postgres is not used.
- No migrations are run.
- No API response shapes change.

