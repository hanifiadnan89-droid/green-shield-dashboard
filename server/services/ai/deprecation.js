// Tiny helper for soft-deprecating AI routes. Sets standard response headers
// (Deprecation, X-GreenShield-Replacement) without changing JSON body, status
// code, or behavior. Safe to call defensively — never throws.

const SAFE_REPLACEMENT_PATH = /^\/[A-Za-z0-9/_-]*$/;

export function markDeprecatedRoute(res, { replacementPath } = {}) {
  if (!res || typeof res.setHeader !== 'function') return;
  try {
    res.setHeader('Deprecation', 'true');
    if (typeof replacementPath === 'string' && SAFE_REPLACEMENT_PATH.test(replacementPath)) {
      res.setHeader('X-GreenShield-Replacement', replacementPath);
    }
  } catch {
    // Defense in depth: header writes after headers-sent throw in Express.
    // A soft-deprecation hint must never break the request.
  }
}

export default { markDeprecatedRoute };
