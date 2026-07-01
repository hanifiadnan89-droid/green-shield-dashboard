import { describe, expect, it } from 'vitest';
import { markDeprecatedRoute } from '../deprecation.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) {
      headers[name] = value;
      return this;
    },
  };
}

describe('markDeprecatedRoute', () => {
  it('sets Deprecation: true and X-GreenShield-Replacement for a safe replacement path', () => {
    const res = mockRes();
    markDeprecatedRoute(res, { replacementPath: '/api/ai/assist-reply' });
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBe('/api/ai/assist-reply');
  });

  it('sets the Deprecation header but skips replacement when replacementPath is missing', () => {
    const res = mockRes();
    markDeprecatedRoute(res, {});
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBeUndefined();
  });

  it('refuses to embed unsafe characters in the replacement header', () => {
    const res = mockRes();
    markDeprecatedRoute(res, { replacementPath: '/api/ai/assist-reply?secret=sk-leaked' });
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBeUndefined();
  });

  it('refuses to write a CRLF-injected replacement header', () => {
    const res = mockRes();
    markDeprecatedRoute(res, { replacementPath: '/api/ai/assist-reply\r\nX-Evil: 1' });
    expect(res.headers.Deprecation).toBe('true');
    expect(res.headers['X-GreenShield-Replacement']).toBeUndefined();
  });

  it('does not throw when res is missing or malformed', () => {
    expect(() => markDeprecatedRoute(null, { replacementPath: '/api/ai/assist-reply' })).not.toThrow();
    expect(() => markDeprecatedRoute(undefined)).not.toThrow();
    expect(() => markDeprecatedRoute({}, { replacementPath: '/api/ai/assist-reply' })).not.toThrow();
  });

  it('does not throw when setHeader itself throws (e.g. headers already sent)', () => {
    const res = {
      setHeader() { throw new Error('headers already sent'); },
    };
    expect(() => markDeprecatedRoute(res, { replacementPath: '/api/ai/assist-reply' })).not.toThrow();
  });

  it('does not mutate the response body or include any secret/prompt data in headers', () => {
    const res = mockRes();
    markDeprecatedRoute(res, { replacementPath: '/api/ai/sales-coach/module' });
    expect(res.body).toBeUndefined();
    const serialized = JSON.stringify(res.headers);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('ANTHROPIC_API_KEY');
    expect(serialized).not.toContain('OPENAI_API_KEY');
  });
});
