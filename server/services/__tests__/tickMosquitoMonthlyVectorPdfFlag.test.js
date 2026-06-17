import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isTickMosquitoMonthlyVectorPdfEnabled } from '../tickMosquitoMonthlyVectorPdfFlag.js';

describe('isTickMosquitoMonthlyVectorPdfEnabled', () => {
  let previousFlag;

  beforeEach(() => {
    previousFlag = process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF;
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF;
    else process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF = previousFlag;
  });

  it('is enabled by default', () => {
    delete process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF;
    expect(isTickMosquitoMonthlyVectorPdfEnabled()).toBe(true);
  });

  it('can be disabled explicitly', () => {
    process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF = 'false';
    expect(isTickMosquitoMonthlyVectorPdfEnabled()).toBe(false);
  });
});
