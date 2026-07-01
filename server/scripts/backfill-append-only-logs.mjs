import { fileURLToPath } from 'url';
import { backfillAppendOnlyLogs } from '../repositories/backfill/appendOnlyLogBackfill.js';
import { parseAppendOnlyLogArgs, printJsonSummary } from '../repositories/backfill/appendOnlyLogCli.js';

export async function main(argv = process.argv.slice(2), logger = console) {
  const options = parseAppendOnlyLogArgs(argv);
  const result = await backfillAppendOnlyLogs(options);
  printJsonSummary(result, logger);
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err?.message || err);
    process.exitCode = 1;
  });
}

