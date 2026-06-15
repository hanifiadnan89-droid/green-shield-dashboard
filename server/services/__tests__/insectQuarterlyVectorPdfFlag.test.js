import { describe, it, expect, afterEach } from 'vitest';
import { isInsectQuarterlyVectorPdfEnabled } from '../insectQuarterlyVectorPdfFlag.js';

describe('isInsectQuarterlyVectorPdfEnabled', () => {
  let previous;

  afterEach(() => {
    if (previous === undefined) delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
    else process.env.INSECT_QUARTERLY_VECTOR_PDF = previous;
  });

  it('is true by default when unset', () => {
    previous = process.env.INSECT_QUARTERLY_VECTOR_PDF;
    delete process.env.INSECT_QUARTERLY_VECTOR_PDF;
    expect(isInsectQuarterlyVectorPdfEnabled()).toBe(true);
  });

  it('accepts common truthy values', () => {
    previous = process.env.INSECT_QUARTERLY_VECTOR_PDF;
    for (const value of ['true', 'TRUE', ' True ', '1', 'yes', 'on']) {
      process.env.INSECT_QUARTERLY_VECTOR_PDF = value;
      expect(isInsectQuarterlyVectorPdfEnabled()).toBe(true);
    }
  });

  it('can be disabled explicitly', () => {
    previous = process.env.INSECT_QUARTERLY_VECTOR_PDF;
    for (const value of ['false', '0', 'no', 'off']) {
      process.env.INSECT_QUARTERLY_VECTOR_PDF = value;
      expect(isInsectQuarterlyVectorPdfEnabled()).toBe(false);
    }
  });
});
