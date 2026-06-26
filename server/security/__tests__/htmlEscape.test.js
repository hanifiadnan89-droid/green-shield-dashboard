import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../htmlEscape.js';

describe('escapeHtml', () => {
  it('escapes characters that can break HTML text and attributes', () => {
    expect(escapeHtml('"><script>alert(1)</script>')).toBe(
      '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('Adam & Sons <Test>')).toBe('Adam &amp; Sons &lt;Test&gt;');
    expect(escapeHtml('O\'Connor "Customer"')).toBe('O&#39;Connor &quot;Customer&quot;');
  });

  it('handles nullish values as empty strings', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
