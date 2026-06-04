import { describe, it, expect } from 'vitest';
import {
  normalizeTechnicianName,
  resolveTechnicianPhotoUrl,
  technicianInitials,
} from './technicianPhotoUtils.js';

const CATALOG = {
  'Colby Thayer': 'https://example.com/1.jpg',
  Paige: 'https://example.com/paige.jpg',
  'Lee G': 'https://example.com/lee-g.jpg',
  Tracey: 'https://example.com/tracey.jpg',
};

describe('resolveTechnicianPhotoUrl', () => {
  it('returns exact match', () => {
    expect(resolveTechnicianPhotoUrl('Colby Thayer', CATALOG)).toBe(CATALOG['Colby Thayer']);
  });

  it('matches first name only catalog entries', () => {
    expect(resolveTechnicianPhotoUrl('Paige Bullock', CATALOG)).toBe(CATALOG.Paige);
  });

  it('matches first name + last initial', () => {
    expect(resolveTechnicianPhotoUrl('Lee Goodwin', CATALOG)).toBe(CATALOG['Lee G']);
  });

  it('is case insensitive', () => {
    expect(resolveTechnicianPhotoUrl('tracey smith', CATALOG)).toBe(CATALOG.Tracey);
  });

  it('returns null when unknown', () => {
    expect(resolveTechnicianPhotoUrl('Unknown Person', CATALOG)).toBeNull();
  });
});

describe('technicianInitials', () => {
  it('uses first and last initial', () => {
    expect(technicianInitials('Paige Bullock')).toBe('PB');
  });

  it('handles single names', () => {
    expect(technicianInitials('Tracey')).toBe('TR');
  });
});

describe('normalizeTechnicianName', () => {
  it('strips punctuation', () => {
    expect(normalizeTechnicianName('Lee G.')).toBe('lee g');
  });
});
