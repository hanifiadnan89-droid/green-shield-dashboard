const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|auth[_-]?token|password|secret|token|cookie|session)/i;
const SECRET_VALUE_PATTERN = /(Bearer\s+[A-Za-z0-9._~+/=-]+|Basic\s+[A-Za-z0-9+/=-]+|sk-[A-Za-z0-9_-]+)/gi;

function sanitize(value, depth = 0) {
  if (depth > 5) return '[Max depth exceeded]';
  if (value == null) return value;
  if (typeof value === 'string') return value.replace(SECRET_VALUE_PATTERN, '[REDACTED]');
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitize(raw, depth + 1);
    }
    return out;
  }
  return String(value);
}

function normalizeError(error) {
  if (error instanceof Error) {
    return {
      message: error.message,
      errorCode: error.code || error.name,
      stackTrace: error.stack,
      httpStatus: error.httpStatus,
      rawMetadata: {
        hint: error.hint,
        isNetworkError: error.isNetworkError,
      },
    };
  }
  if (typeof error === 'string') return { message: error };
  return {
    message: error?.message || 'Frontend error',
    errorCode: error?.code || error?.name,
    httpStatus: error?.httpStatus,
    rawMetadata: error,
  };
}

export function reportFrontendError(error, context = {}) {
  try {
    const normalized = normalizeError(error);
    const payload = sanitize({
      source: 'frontend',
      severity: context.severity || (normalized.httpStatus >= 500 ? 'high' : 'medium'),
      page: context.page || window.location.pathname,
      module: context.module || context.page || 'frontend',
      endpoint: context.endpoint || '',
      httpStatus: normalized.httpStatus || context.httpStatus,
      errorCode: context.errorCode || normalized.errorCode,
      message: normalized.message || context.message || 'Frontend error',
      stackTrace: normalized.stackTrace,
      userFacingMessage: context.userFacingMessage || '',
      suggestedFix: context.suggestedFix || '',
      likelyCause: context.likelyCause || '',
      rawMetadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...normalized.rawMetadata,
        ...context.rawMetadata,
      },
    });

    fetch('/api/errors', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never affect product behavior.
  }
}

export function installGlobalErrorReporter() {
  window.addEventListener('error', (event) => {
    reportFrontendError(event.error || event.message, {
      severity: 'high',
      module: 'window.error',
      rawMetadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportFrontendError(event.reason || 'Unhandled promise rejection', {
      severity: 'high',
      module: 'unhandledrejection',
    });
  });
}
