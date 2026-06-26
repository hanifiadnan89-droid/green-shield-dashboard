# CRM Error Center

The Error Center stores operational CRM errors for frontend, backend, API,
integration, AI, signing, PDF, route-finder, and Knowledge Base workflows.

## Storage

Production error history must be stored on durable storage. On Render, configure
a persistent disk and set:

```txt
ERROR_LOG_STORAGE_BACKEND=persistent_disk
ERROR_LOG_DATA_DIR=/var/data/error-center
```

If `ERROR_LOG_DATA_DIR` is omitted, the server can store error history under the
durable Knowledge Base directory when:

```txt
KNOWLEDGE_STORAGE_BACKEND=persistent_disk
KNOWLEDGE_DATA_DIR=/var/data/knowledge-base
```

Local development defaults to `server/data/crm-error-log.json` and logs a warning
that repo-local storage is not production-safe.

## Security

The error logger redacts sensitive keys and common credential values before
writing records. Do not intentionally include API keys, auth headers, passwords,
tokens, cookies, or full session payloads in error metadata.

## UI

The dashboard route is:

```txt
/errors
```

The sidebar item is labeled `Error Center`.

## Release Context

Each error automatically records deployment metadata when it is created:

- `RENDER_GIT_COMMIT`, `GIT_COMMIT`, or `COMMIT_SHA`
- `APP_VERSION` or package version fallback
- `RENDER_DEPLOY_ID`, `DEPLOYMENT_ID`, or `RENDER_SERVICE_ID`
- environment, hostname/server instance, process uptime, and Node version

## AI Analysis

The Error Center includes an optional `Analyze Error` action. It uses the
existing Anthropic AI infrastructure when `ANTHROPIC_API_KEY` is configured and
caches the generated analysis on the error record. If AI is unavailable, the
Error Center continues to function normally and shows a non-blocking unavailable
message.
