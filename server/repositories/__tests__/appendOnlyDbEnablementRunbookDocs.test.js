import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '../../..');
const RUNBOOK_PATH = path.join(REPO_DIR, 'docs', 'append-only-db-enablement-runbook.md');

function readRunbook() {
  return fs.readFileSync(RUNBOOK_PATH, 'utf-8');
}

describe('append-only DB enablement runbook', () => {
  it('exists at the documented path', () => {
    expect(fs.existsSync(RUNBOOK_PATH)).toBe(true);
  });

  it('explains the validation command and the safe enablement sequence', () => {
    const text = readRunbook();
    expect(text).toMatch(/npm run db:validate:append-only --prefix server/);
    expect(text).toMatch(/npm run db:migrate:status --prefix server/);
    expect(text).toMatch(/npm run db:migrate --prefix server/);
    expect(text).toMatch(/npm run db:backfill:append-only --prefix server -- --domain=all/);
    expect(text).toMatch(/npm run db:backfill:append-only --prefix server -- --domain=all --apply/);
    expect(text).toMatch(/npm run db:reconcile:append-only --prefix server -- --domain=all/);
    expect(text).toMatch(/npm run db:reconcile:append-only --prefix server -- --domain=all --strict/);
  });

  it('names the write flags that may be enabled after validation passes', () => {
    const text = readRunbook();
    expect(text).toMatch(/DB_WRITE_AI_USAGE_ENABLED=true/);
    expect(text).toMatch(/DB_WRITE_ERROR_LOG_ENABLED=true/);
  });

  it('documents that DB read flags must stay OFF in this stage', () => {
    const text = readRunbook();
    expect(text).toMatch(/DB_READ_AI_USAGE_ENABLED=false/);
    expect(text).toMatch(/DB_READ_ERROR_LOG_ENABLED=false/);
    expect(text).toMatch(/Keep read flags OFF|keep read flags OFF/i);
  });

  it('documents a rollback that disables every append-only flag', () => {
    const text = readRunbook();
    const rollbackSection = text.split(/##\s+7/i)[1] || '';
    expect(rollbackSection).toMatch(/DB_WRITE_AI_USAGE_ENABLED=false/);
    expect(rollbackSection).toMatch(/DB_WRITE_ERROR_LOG_ENABLED=false/);
    expect(rollbackSection).toMatch(/DB_READ_AI_USAGE_ENABLED=false/);
    expect(rollbackSection).toMatch(/DB_READ_ERROR_LOG_ENABLED=false/);
  });

  it('explicitly excludes leads, conversations, users, integrations, and read cutover from scope', () => {
    const text = readRunbook();
    expect(text).toMatch(/leads/i);
    expect(text).toMatch(/conversation/i);
    expect(text).toMatch(/users/i);
    expect(text).toMatch(/integration/i);
    expect(text).toMatch(/read cutover|reads to Postgres|reads on JSON/i);
  });

  it('does not contain secret-shaped strings or absolute DATABASE_URL credentials', () => {
    const text = readRunbook();
    expect(text).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9_.-]{16,}/);
    expect(text).not.toMatch(/postgres:\/\/[^*\s:][^:\s]*:[^@\s*]+@/);
  });

  // Stage 35: pre-flight report section
  it('documents the opt-in --write-report flag for a sanitized JSON pre-flight report', () => {
    const text = readRunbook();
    expect(text).toMatch(/--write-report=/);
    expect(text).toMatch(/npm run db:validate:append-only --prefix server -- --write-report=/);
    expect(text).toMatch(/--json --write-report=/);
    expect(text).toMatch(/opt-in only/i);
  });

  it('documents what the report must not contain', () => {
    const text = readRunbook();
    expect(text).toMatch(/DATABASE_URL/);
    expect(text).toMatch(/credentials/i);
    expect(text).toMatch(/secrets/i);
    expect(text).toMatch(/raw customer data/i);
    expect(text).toMatch(/raw AI prompts/i);
    expect(text).toMatch(/raw Error Center contents/i);
    expect(text).toMatch(/process\.env/);
  });

  it('reminds operators that writing a report still enables nothing', () => {
    const text = readRunbook();
    expect(text).toMatch(/no flags are mutated/i);
    expect(text).toMatch(/no migrations are applied/i);
    expect(text).toMatch(/no backfill is run/i);
    expect(text).toMatch(/no reads are switched/i);
  });

  // Stage 36: CI/Staging validation gate section
  it('documents the CI/Staging validation gate', () => {
    const text = readRunbook();
    expect(text).toMatch(/##\s+9\.\s+CI\/Staging validation gate/);
    expect(text).toMatch(/\.github\/workflows\/append-only-db-validation\.yml/);
    expect(text).toMatch(/disposable Postgres|disposable.*postgres|postgres:16/i);
    expect(text).toMatch(/workflow_dispatch/);
  });

  it('CI section states that no production flags are enabled and no production backfill is run', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toContain('`DB_WRITE_AI_USAGE_ENABLED`');
    expect(ciSection).toContain('`DB_WRITE_ERROR_LOG_ENABLED`');
    expect(ciSection).toContain('`DB_READ_AI_USAGE_ENABLED`');
    expect(ciSection).toContain('`DB_READ_ERROR_LOG_ENABLED`');
    expect(ciSection).toMatch(/Never.+(enable|enables)/i);
    expect(ciSection).toContain('--apply');
    expect(ciSection).toMatch(/production data|production secrets|production Postgres/i);
    expect(ciSection).toMatch(/JSON\/file stores remain the source of truth/);
    expect(ciSection).toMatch(/Production enablement still requires/);
  });

  it('CI section names the report artifact path and the upload artifact name', () => {
    const text = readRunbook();
    expect(text).toMatch(/reports\/append-only-validation-ci\.json/);
    expect(text).toMatch(/append-only-validation-report/);
  });

  it('CI section shows the local staging command sequence using the validator', () => {
    const text = readRunbook();
    expect(text).toMatch(/npm run db:migrate:status --prefix server/);
    expect(text).toMatch(/npm run db:migrate --prefix server/);
    expect(text).toMatch(/npm run db:validate:append-only --prefix server -- --json --write-report=\.\/reports\/append-only-validation-staging\.json/);
    expect(text).toMatch(/run-append-only-validation-ci\.mjs/);
  });

  // Stage 37: staging baseline evidence capture subsection
  it('documents the staging baseline evidence capture subsection inside section 9', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toMatch(/###\s+Staging baseline evidence capture/);
    expect(ciSection).toMatch(/Trigger the GitHub Actions workflow manually/i);
    expect(ciSection).toMatch(/Download the artifact/i);
    expect(ciSection).toMatch(/append-only-validation-report/);
  });

  it('staging baseline subsection names the local staging command and inspection criteria', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging baseline evidence capture/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/npm run db:validate:append-only:ci --prefix server -- \\?\s*\n?\s*--migrate \\?\s*\n?\s*--report=\.\/reports\/append-only-validation-staging\.json/);
    expect(subsection).toMatch(/status/);
    expect(subsection).toMatch(/safeSummary/);
    expect(subsection).toMatch(/writeFlagsEnabled: false/);
    expect(subsection).toMatch(/readFlagsEnabled: false/);
    expect(subsection).toContain('`warningCount`');
    expect(subsection).toContain('`failureCount`');
  });

  it('staging baseline subsection is explicit that capturing the baseline does NOT authorize production enablement, backfill, or lead migration', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging baseline evidence capture/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/does\s+\*\*not\*\*\s+authorize/i);
    expect(subsection).toContain('`DB_WRITE_AI_USAGE_ENABLED`');
    expect(subsection).toContain('`DB_WRITE_ERROR_LOG_ENABLED`');
    expect(subsection).toContain('`DB_READ_');
    expect(subsection).toMatch(/switching reads to Postgres/i);
    expect(subsection).toMatch(/lead.+conversation.+user.+integration/i);
    expect(subsection).toMatch(/--apply.+backfill/i);
    expect(subsection).toMatch(/live CRM data/i);
  });

  it('runbook points at the committed example baseline JSON', () => {
    const text = readRunbook();
    expect(text).toMatch(/docs\/examples\/append-only-validation-baseline\.example\.json/);
  });

  // Stage 38: admin endpoint + CLI strictness sections
  it('documents the admin-only GET /api/admin/db/append-only/validation endpoint', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toMatch(/###\s+Admin validation endpoint/);
    expect(ciSection).toContain('GET /api/admin/db/append-only/validation');
    expect(ciSection).toMatch(/requireAdmin/);
    expect(ciSection).toMatch(/Read-only/i);
    expect(ciSection).toMatch(/30 seconds|cacheTtlSeconds/);
    expect(ciSection).toMatch(/refresh=true/);
    expect(ciSection).toMatch(/DATABASE_URL/);
    expect(ciSection).toMatch(/no flag toggle|no UI/i);
  });

  it('documents the CLI strictness flags --max-failure-count and --max-warning-count', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toMatch(/###\s+CLI strictness flags/);
    expect(ciSection).toContain('--max-failure-count=');
    expect(ciSection).toContain('--max-warning-count=');
    expect(ciSection).toMatch(/Default behavior is unchanged/i);
    expect(ciSection).toMatch(/Invalid threshold values/);
  });

  it('admin endpoint + strictness sections reaffirm no production enablement', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toContain('`DB_WRITE_AI_USAGE_ENABLED`');
    expect(ciSection).toContain('`DB_WRITE_ERROR_LOG_ENABLED`');
    expect(ciSection).toMatch(/JSON\/file stores remain the source of truth/);
    expect(ciSection).toMatch(/Live CRM data is untouched/i);
  });

  // Stage 39: admin UI readiness banner subsection
  it('documents the Admin UI readiness banner subsection', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toMatch(/###\s+Admin UI readiness banner/);
    expect(ciSection).toMatch(/\/admin\/ai-observability/);
    expect(ciSection).toMatch(/Usage log storage/);
    expect(ciSection).toContain('`pass`');
    expect(ciSection).toContain('`warn`');
    expect(ciSection).toContain('`fail`');
    expect(ciSection).toMatch(/Refresh/);
    expect(ciSection).toMatch(/\?refresh=true/);
    expect(ciSection).toMatch(/Read-only/i);
  });

  it('Admin UI readiness banner subsection asserts no flag toggle / migration / backfill / report-download buttons', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Admin UI readiness banner/i)[1]?.split(/###\s+CLI strictness flags/i)[0] || '';
    expect(subsection).toContain('flag toggle button');
    expect(subsection).toContain('migration trigger');
    expect(subsection).toContain('backfill trigger');
    expect(subsection).toContain('report-download button');
    // Each prohibition is explicitly negated. Tolerate markdown line-wrap by
    // accepting any whitespace (including newlines) between the **no** marker
    // and the prohibited phrase.
    expect(subsection).toMatch(/\*\*no\*\*[\s\S]+?flag toggle button/i);
    expect(subsection).toMatch(/\*\*no\*\*[\s\S]+?migration trigger/i);
    expect(subsection).toMatch(/\*\*no\*\*[\s\S]+?backfill trigger/i);
    expect(subsection).toMatch(/\*\*no\*\*[\s\S]+?report-download button/i);
    expect(subsection).toContain('`DB_WRITE_AI_USAGE_ENABLED`');
    expect(subsection).toContain('`DB_WRITE_ERROR_LOG_ENABLED`');
    // Cross-line "does **not** authorize" plus the section-4 reminder.
    expect(subsection).toMatch(/does[\s\S]+?\*\*not\*\*[\s\S]+?authorize/i);
    expect(subsection).toMatch(/manual operator sequence in[\s\S]+?section 4/i);
  });

  // Stage 40: staging-only dual-write exercise subsection
  it('documents the staging-only dual-write exercise subsection inside section 9', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toMatch(/###\s+Staging-only dual-write exercise/);
    expect(ciSection).toMatch(/npm run db:exercise:append-only:staging --prefix server -- \\?[\s\S]*--confirm-staging/);
    expect(ciSection).toMatch(/synthetic data only/i);
    expect(ciSection).toContain('append_only_dual_write_staging');
    expect(ciSection).toContain('stage40_staging_dual_write_exercise');
  });

  it('staging-only dual-write subsection explicitly forbids production writes / real provider calls / Gmail / Twilio / customer data', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging-only dual-write exercise/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/no real AI provider calls/i);
    expect(subsection).toMatch(/no Gmail\/Twilio/i);
    expect(subsection).toMatch(/no customer data/i);
    expect(subsection).toMatch(/synthetic data only/i);
    expect(subsection).toMatch(/--confirm-staging/);
    expect(subsection).toMatch(/NODE_ENV/);
    expect(subsection).toMatch(/DATABASE_URL/);
    expect(subsection).toContain('`DB_READ_AI_USAGE_ENABLED`');
    expect(subsection).toContain('`DB_READ_ERROR_LOG_ENABLED`');
    expect(subsection).toMatch(/Read flags stay `false`|read flags stay/i);
  });

  it('staging-only dual-write subsection states that a clean pass does not authorize production enablement', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging-only dual-write exercise/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/does not authorize production|still does not authorize production/i);
    expect(subsection).toContain('`DB_WRITE_AI_USAGE_ENABLED`');
    expect(subsection).toContain('`DB_WRITE_ERROR_LOG_ENABLED`');
    // Markdown wraps between "in" and "section 4" — accept any whitespace.
    expect(subsection).toMatch(/manual operator sequence in[\s\S]+?section 4/i);
    expect(subsection).toMatch(/JSON\/file stores remain the source of truth/i);
  });

  // Stage 41: staging burn-in validation subsection
  it('documents the Stage 41 staging burn-in validation subsection inside section 9', () => {
    const text = readRunbook();
    const ciSection = text.split(/##\s+9\.\s+CI\/Staging validation gate/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(ciSection).toMatch(/###\s+Staging burn-in validation \(Stage 41\)/);
    expect(ciSection).toMatch(/npm run db:validate:append-only:burn-in:staging --prefix server/);
    expect(ciSection).toContain('stage41_append_only_burn_in_staging');
  });

  it('staging burn-in subsection documents the exact Render environment variables to set for burn-in', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging burn-in validation \(Stage 41\)/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/DB_WRITE_AI_USAGE_ENABLED=true/);
    expect(subsection).toMatch(/DB_WRITE_ERROR_LOG_ENABLED=true/);
    expect(subsection).toMatch(/DB_READ_AI_USAGE_ENABLED=false/);
    expect(subsection).toMatch(/DB_READ_ERROR_LOG_ENABLED=false/);
    expect(subsection).toMatch(/DATABASE_SSL=true/);
    expect(subsection).toMatch(/DATABASE_URL=/);
    expect(subsection).toMatch(/staging backend service/i);
    expect(subsection).toMatch(/Do \*\*not\*\* set them on\s+production|Do \*\*not\*\* set them on production/i);
  });

  it('staging burn-in subsection documents the rollback and keeps read flags OFF', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging burn-in validation \(Stage 41\)/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/\*\*Rollback\*\*/);
    expect(subsection).toMatch(/DB_WRITE_AI_USAGE_ENABLED=false/);
    expect(subsection).toMatch(/DB_WRITE_ERROR_LOG_ENABLED=false/);
    expect(subsection).toMatch(/DB_READ_AI_USAGE_ENABLED=false/);
    expect(subsection).toMatch(/DB_READ_ERROR_LOG_ENABLED=false/);
    expect(subsection).toMatch(/Keep read flags OFF/);
  });

  it('staging burn-in subsection lists all validation check names and marks zero-row cases as warnings', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging burn-in validation \(Stage 41\)/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toContain('env_node_env_not_production');
    expect(subsection).toContain('env_database_url_configured');
    expect(subsection).toContain('env_database_ssl_supported');
    expect(subsection).toContain('flags_read_ai_usage_off');
    expect(subsection).toContain('flags_read_error_log_off');
    expect(subsection).toContain('flags_write_ai_usage_on_for_burn_in');
    expect(subsection).toContain('flags_write_error_log_on_for_burn_in');
    expect(subsection).toContain('db_reachable');
    expect(subsection).toContain('db_migrations_applied');
    expect(subsection).toContain('db_ai_usage_table_present');
    expect(subsection).toContain('db_error_log_table_present');
    expect(subsection).toContain('db_ai_usage_recent_rows');
    expect(subsection).toContain('db_error_log_recent_rows');
    expect(subsection).toContain('current_store_ai_usage_readable');
    expect(subsection).toContain('current_store_error_log_readable');
    expect(subsection).toMatch(/\*\*warn\*\*[\s\S]+?not fail[\s\S]+?zero/i);
  });

  it('staging burn-in subsection explicitly forbids Gmail/Twilio/customer/prod actions and describes sanitized report', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging burn-in validation \(Stage 41\)/i)[1]?.split(/##\s+10\./)[0] || '';
    // Markdown line-wraps split literal spaces; tolerate whitespace incl. newlines.
    expect(subsection).toMatch(/read[-\s]only/i);
    expect(subsection).toMatch(/no `DATABASE_URL`|no DATABASE_URL/);
    expect(subsection).toMatch(/no\s+credentials/i);
    expect(subsection).toMatch(/no\s+raw\s+env/i);
    expect(subsection).toMatch(/no\s+stack\s+traces/i);
    expect(subsection).toMatch(/Gmail\s+or\s+Twilio|Gmail\/Twilio/i);
  });

  it('staging burn-in subsection reaffirms that a clean burn-in does not authorize production enablement', () => {
    const text = readRunbook();
    const subsection = text.split(/###\s+Staging burn-in validation \(Stage 41\)/i)[1]?.split(/##\s+10\./)[0] || '';
    expect(subsection).toMatch(/does not authorize production|not[\s\S]+?authorization/i);
    expect(subsection).toContain('`DB_WRITE_AI_USAGE_ENABLED`');
    expect(subsection).toContain('`DB_WRITE_ERROR_LOG_ENABLED`');
    expect(subsection).toMatch(/manual operator sequence in[\s\S]+?section 4/i);
    expect(subsection).toMatch(/JSON\/file stores remain the source of truth/i);
  });
});
