import { describe, it, expect } from 'vitest';
import { parseLeadName } from './parseLeadName.js';

describe('parseLeadName', () => {
  it('splits trailing account number from name', () => {
    expect(parseLeadName('Susanne Stavis 16051')).toEqual({
      displayName: 'Susanne Stavis',
      accountNumber: '16051',
      rawName: 'Susanne Stavis 16051',
    });
  });

  it('leaves plain names unchanged', () => {
    expect(parseLeadName('John Smith')).toEqual({
      displayName: 'John Smith',
      accountNumber: null,
      rawName: 'John Smith',
    });
  });

  it('does not split short trailing numbers', () => {
    expect(parseLeadName('Unit 12')).toEqual({
      displayName: 'Unit 12',
      accountNumber: null,
      rawName: 'Unit 12',
    });
  });
});
