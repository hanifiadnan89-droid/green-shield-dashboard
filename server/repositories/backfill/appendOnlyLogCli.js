const VALID_DOMAINS = new Set(['all', 'ai_usage', 'error_log']);

function parseNumberOption(value, fallback = null) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseAppendOnlyLogArgs(argv = []) {
  const options = {
    domain: 'all',
    apply: false,
    dryRun: true,
    strict: false,
    limit: null,
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      options.dryRun = false;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg.startsWith('--domain=')) {
      const domain = arg.slice('--domain='.length).trim();
      if (!VALID_DOMAINS.has(domain)) {
        const err = new Error(`Invalid domain: ${domain}`);
        err.code = 'INVALID_APPEND_ONLY_DOMAIN';
        throw err;
      }
      options.domain = domain;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseNumberOption(arg.slice('--limit='.length));
    }
  }

  return options;
}

export function printJsonSummary(result, logger = console) {
  logger.log(JSON.stringify(result, null, 2));
}

