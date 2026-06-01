import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAuthConfigDiagnostics,
  getAuthStateSource,
} from '../fieldRoutesAuth.js';

const SAMPLE_STATE = {
  cookies: [
    { name: 'PHPSESSID', domain: 'greenshieldpestsolutions.fieldroutes.com', value: 'secret' },
  ],
  origins: [],
};

describe('fieldRoutesAuth diagnostics', () => {
  const prevEnv = process.env.FIELDROUTES_AUTH_STATE_JSON;
  const prevRender = process.env.RENDER;

  afterEach(() => {
    if (prevEnv === undefined) delete process.env.FIELDROUTES_AUTH_STATE_JSON;
    else process.env.FIELDROUTES_AUTH_STATE_JSON = prevEnv;
    if (prevRender === undefined) delete process.env.RENDER;
    else process.env.RENDER = prevRender;
  });

  beforeEach(() => {
    delete process.env.FIELDROUTES_AUTH_STATE_JSON;
    delete process.env.RENDER;
  });

  it('reports env source when FIELDROUTES_AUTH_STATE_JSON is set', () => {
    process.env.FIELDROUTES_AUTH_STATE_JSON = JSON.stringify(SAMPLE_STATE);
    expect(getAuthStateSource()).toBe('env');
    const diag = getAuthConfigDiagnostics();
    expect(diag.authSource).toBe('env');
    expect(diag.envVar.configured).toBe(true);
    expect(diag.envVar.parseOk).toBe(true);
    expect(diag.envVar.fieldRoutesCookieCount).toBe(1);
    expect(diag.envVar.cookieNames).toContain('PHPSESSID');
    expect(JSON.stringify(diag)).not.toContain('secret');
  });

  it('reports parse failure without exposing raw JSON', () => {
    process.env.FIELDROUTES_AUTH_STATE_JSON = '{not json';
    const diag = getAuthConfigDiagnostics();
    expect(diag.envVar.parseOk).toBe(false);
    expect(diag.envVar.parseError).toBeTruthy();
    expect(JSON.stringify(diag)).not.toContain('not json');
  });

  it('recommends paste on Render when env missing', () => {
    process.env.RENDER = 'true';
    const diag = getAuthConfigDiagnostics();
    expect(diag.deployTarget).toBe('render');
    expect(diag.recommendation).toMatch(/paste|credentials/i);
  });
});
