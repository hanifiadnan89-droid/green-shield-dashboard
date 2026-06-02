/**
 * Google service account credential loading and safe diagnostics.
 * Never log or return private_key or full JSON.
 */

import { existsSync, readFileSync } from 'fs';

function validateServiceAccountShape(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return 'Service account JSON must be an object.';
  }
  if (!parsed.client_email || typeof parsed.client_email !== 'string') {
    return 'Service account JSON is missing client_email.';
  }
  if (!parsed.private_key || typeof parsed.private_key !== 'string') {
    return 'Service account JSON is missing private_key.';
  }
  return null;
}

function tryParseJson(raw, label) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: `${label} is empty` };
  }
  try {
    return { ok: true, parsed: JSON.parse(trimmed) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * @returns {{
 *   ok: boolean,
 *   status: 'ok' | 'missing' | 'invalid_json' | 'invalid_shape' | 'file_missing',
 *   source: 'env_json' | 'env_file' | 'none',
 *   message: string | null,
 *   parseError: string | null,
 *   credentials?: object,
 * }}
 */
export function getGoogleCredentialsDiagnostics() {
  const jsonRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const filePath = (process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();

  if (jsonRaw) {
    const parsed = tryParseJson(jsonRaw, 'GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!parsed.ok) {
      return {
        ok: false,
        status: 'invalid_json',
        source: 'env_json',
        message:
          'GOOGLE_SERVICE_ACCOUNT_JSON is set but is not valid JSON. '
          + 'On Render, paste the entire service account file as one line (no extra quotes).',
        parseError: parsed.error,
      };
    }
    const shapeError = validateServiceAccountShape(parsed.parsed);
    if (shapeError) {
      return {
        ok: false,
        status: 'invalid_shape',
        source: 'env_json',
        message: `GOOGLE_SERVICE_ACCOUNT_JSON: ${shapeError}`,
        parseError: null,
      };
    }
    return {
      ok: true,
      status: 'ok',
      source: 'env_json',
      message: null,
      parseError: null,
      credentials: parsed.parsed,
    };
  }

  if (filePath) {
    if (!existsSync(filePath)) {
      return {
        ok: false,
        status: 'file_missing',
        source: 'env_file',
        message: `GOOGLE_SERVICE_ACCOUNT_FILE path does not exist: ${filePath}`,
        parseError: null,
      };
    }
    let fileRaw;
    try {
      fileRaw = readFileSync(filePath, 'utf8');
    } catch (err) {
      return {
        ok: false,
        status: 'file_missing',
        source: 'env_file',
        message: `Could not read GOOGLE_SERVICE_ACCOUNT_FILE: ${err.message}`,
        parseError: null,
      };
    }
    const parsed = tryParseJson(fileRaw, 'service account file');
    if (!parsed.ok) {
      return {
        ok: false,
        status: 'invalid_json',
        source: 'env_file',
        message: 'Service account file is not valid JSON.',
        parseError: parsed.error,
      };
    }
    const shapeError = validateServiceAccountShape(parsed.parsed);
    if (shapeError) {
      return {
        ok: false,
        status: 'invalid_shape',
        source: 'env_file',
        message: shapeError,
        parseError: null,
      };
    }
    return {
      ok: true,
      status: 'ok',
      source: 'env_file',
      message: null,
      parseError: null,
      credentials: parsed.parsed,
    };
  }

  return {
    ok: false,
    status: 'missing',
    source: 'none',
    message: process.env.RENDER
      ? 'GOOGLE_SERVICE_ACCOUNT_JSON is not set in Render Environment.'
      : 'GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE is not set (server/.env locally).',
    parseError: null,
  };
}

export function loadGoogleCredentials() {
  const diag = getGoogleCredentialsDiagnostics();
  if (!diag.ok) {
    throw new Error(diag.message || 'Google credentials are not configured.');
  }
  return diag.credentials;
}
