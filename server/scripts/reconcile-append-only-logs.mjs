import { fileURLToPath } from 'url';
import { reconcileAppendOnlyLogs } from '../repositories/backfill/appendOnlyLogReconciliation.js';
import { parseAppendOnlyLogArgs, printJsonSummary } from '../repositories/backfill/appendOnlyLogCli.js';

export async function main(argv = process.argv.slice(2), logger = console) {
  const options = parseAppendOnlyLogArgs(argv);
  const result = await reconcileAppendOnlyLogs(options);
  printJsonSummary(result, logger);
  if (options.strict && !result.matched) {
    const err = new Error('Append-only log reconciliation failed.');
    err.code = 'APPEND_ONLY_RECONCILIATION_FAILED';
    err.result = result;
    throw err;
  }
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  });
}

