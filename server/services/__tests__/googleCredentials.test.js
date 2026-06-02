import { describe, it, expect, afterEach } from 'vitest';
import {
  getGoogleCredentialsDiagnostics,
  loadGoogleCredentials,
} from '../googleCredentials.js';

const SAMPLE = {
  type: 'service_account',
  client_email: 'test@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
};

describe('googleCredentials', () => {
  const prevJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const prevFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  const prevRender = process.env.RENDER;

  afterEach(() => {
    if (prevJson === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = prevJson;
    if (prevFile === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    else process.env.GOOGLE_SERVICE_ACCOUNT_FILE = prevFile;
    if (prevRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = prevRender;
  });

  it('reports ok when env JSON is valid', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(SAMPLE);
    const diag = getGoogleCredentialsDiagnostics();
    expect(diag.ok).toBe(true);
    expect(diag.status).toBe('ok');
    expect(diag.source).toBe('env_json');
    expect(loadGoogleCredentials().client_email).toBe(SAMPLE.client_email);
    const publicFields = JSON.stringify({
      status: diag.status,
      message: diag.message,
      parseError: diag.parseError,
    });
    expect(publicFields).not.toContain('BEGIN PRIVATE KEY');
  });

  it('reports invalid_json when env JSON is malformed', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{bad';
    const diag = getGoogleCredentialsDiagnostics();
    expect(diag.ok).toBe(false);
    expect(diag.status).toBe('invalid_json');
    expect(diag.parseError).toBeTruthy();
  });

  it('reports missing on Render when unset', () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
    process.env.RENDER = 'true';
    const diag = getGoogleCredentialsDiagnostics();
    expect(diag.status).toBe('missing');
    expect(diag.message).toMatch(/Render Environment/i);
  });
});
