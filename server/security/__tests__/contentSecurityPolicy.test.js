import { describe, it, expect } from 'vitest';
import { buildContentSecurityPolicyDirectives } from '../contentSecurityPolicy.js';

describe('contentSecurityPolicy', () => {
  it('allows Google Maps scripts and gshieldpest technician images', () => {
    const d = buildContentSecurityPolicyDirectives();

    expect(d['script-src']).toContain('https://maps.googleapis.com');
    expect(d['script-src']).toContain('https://maps.gstatic.com');
    expect(d['script-src']).toContain('https://*.googleapis.com');
    expect(d['script-src']).toContain('https://*.gstatic.com');

    expect(d['connect-src']).toContain('https://maps.googleapis.com');
    expect(d['connect-src']).toContain('https://maps.gstatic.com');
    expect(d['connect-src']).toContain('https://*.googleapis.com');
    expect(d['connect-src']).toContain('https://*.gstatic.com');
    expect(d['connect-src']).toContain('https://places.googleapis.com');
    expect(d['connect-src']).toContain('https://weather.googleapis.com');
    expect(d['connect-src']).toContain('https://addressvalidation.googleapis.com');

    expect(d['img-src']).toContain('https://maps.googleapis.com');
    expect(d['img-src']).toContain('https://maps.gstatic.com');
    expect(d['img-src']).toContain('https://*.googleapis.com');
    expect(d['img-src']).toContain('https://*.gstatic.com');
    expect(d['img-src']).toContain('https://*.googleusercontent.com');
    expect(d['img-src']).toContain('https://gshieldpest.com');
    expect(d['img-src']).toContain('https://www.gshieldpest.com');

    expect(d['frame-src']).toContain('https://maps.googleapis.com');
    expect(d['frame-src']).toContain('https://maps.gstatic.com');
    expect(d['frame-src']).toContain('https://*.googleapis.com');
    expect(d['frame-src']).toContain('https://*.gstatic.com');

    expect(d['worker-src']).toContain('blob:');
    expect(d['child-src']).toContain('blob:');
  });

  it('allows Google Maps vector/WebGL wasm and eval requirements', () => {
    const d = buildContentSecurityPolicyDirectives();

    expect(d['script-src']).toContain("'unsafe-eval'");
    expect(d['script-src']).toContain("'wasm-unsafe-eval'");
    expect(d['script-src']).toContain('blob:');
    expect(d['connect-src']).toContain('blob:');
    expect(d['connect-src']).toContain('data:');
    expect(d['worker-src']).toContain('https://maps.gstatic.com');
    expect(d['worker-src']).toContain('https://*.gstatic.com');
    expect(d['child-src']).toContain('https://maps.gstatic.com');
    expect(d['child-src']).toContain('https://*.gstatic.com');
  });

  it('keeps default-src self restriction', () => {
    const d = buildContentSecurityPolicyDirectives();
    expect(d['default-src']).toContain("'self'");
  });
});
