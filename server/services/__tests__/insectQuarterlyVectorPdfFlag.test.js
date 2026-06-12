import { describe, it, expect, afterEach } from 'vitest';
import { isInsectQuarterlyVectorPdfEnabled } from '../insectQuarterlyVectorPdfFlag.js';

describe('isInsectQuarterlyVectorPdfEnabled', () => {
  let previous;

  afterEach(() => {
    if (previous === undefined) delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
    else process.env.INSECT_QUARTERLY_VECTOR_PDF = previous;
  });

  it('is false when unset', () => {
    previous = process.env.INSECT_QUARTERLY_VECTOR_PDF;
    delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
    expect(isInsectQuarterlyVectorPdfEnabled()).toBe(false);
  });

  it('accepts common truthy values', () => {
    previous = process.env.INSECT_QUARTERLY_VECTOR_PDF;
    for (const value of ['true', 'TRUE', ' True ', '1', 'yes', 'on']) {
      process.env.INSECT_QUARTERLY_VECTOR_PDF = value;
      expect(isInsectQuarterlyVectorPdfEnabled()).toBe(true);
    }
  });
});
