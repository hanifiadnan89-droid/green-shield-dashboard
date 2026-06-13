import { describe, it, expect, afterEach } from 'vitest';
import { isRodentInsectTriannualVectorPdfEnabled } from '../rodentInsectTriannualVectorPdfFlag.js';

describe('isRodentInsectTriannualVectorPdfEnabled', () => {
  let previous;

  afterEach(() => {
    if (previous === undefined) delete process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
    else process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF = previous;
  });

  it('is false when unset', () => {
    previous = process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
    delete process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
    expect(isRodentInsectTriannualVectorPdfEnabled()).toBe(false);
  });

  it('accepts common truthy values', () => {
    previous = process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF;
    for (const value of ['true', 'TRUE', ' True ', '1', 'yes', 'on']) {
      process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF = value;
      expect(isRodentInsectTriannualVectorPdfEnabled()).toBe(true);
    }
  });
});
