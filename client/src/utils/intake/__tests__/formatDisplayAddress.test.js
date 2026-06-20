import { describe, expect, it } from 'vitest';
import { formatDisplayAddress } from '../formatDisplayAddress.js';

describe('formatDisplayAddress', () => {
  it('removes ZIP+4 and country suffix', () => {
    expect(formatDisplayAddress('34B Cloudman Street, Westbrook, ME 04092-3404, USA'))
      .toBe('34B Cloudman Street, Westbrook, ME 04092');
  });

  it('removes United States suffix', () => {
    expect(formatDisplayAddress('123 Main St, Portland, ME 04101, United States'))
      .toBe('123 Main St, Portland, ME 04101');
  });

  it('keeps standard five-digit ZIP', () => {
    expect(formatDisplayAddress('34B Cloudman Street, Westbrook, ME 04092'))
      .toBe('34B Cloudman Street, Westbrook, ME 04092');
  });
});
