import { describe, it, expect, afterEach } from 'vitest';
import { isBedBugInsectTriannualVectorPdfEnabled } from '../bedBugInsectTriannualVectorPdfFlag.js';

describe('isBedBugInsectTriannualVectorPdfEnabled', () => {
  let previous;

  afterEach(() => {
    if (previous === undefined) delete process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF;
    else process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF = previous;
  });

  it('is false when unset', () => {
    previous = process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF;
    delete process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF;
    expect(isBedBugInsectTriannualVectorPdfEnabled()).toBe(false);
  });

  it('accepts common truthy values', () => {
    previous = process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF;
    for (const value of ['true', 'TRUE', ' True ', '1', 'yes', 'on']) {
      process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF = value;
      expect(isBedBugInsectTriannualVectorPdfEnabled()).toBe(true);
    }
  });
});
