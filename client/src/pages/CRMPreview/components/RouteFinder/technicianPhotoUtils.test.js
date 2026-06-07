import { describe, it, expect, vi } from 'vitest';
import {
  normalizeTechnicianName,
  resolveTechnicianPhoto,
  resolveTechnicianPhotoUrl,
  technicianInitials,
} from './technicianPhotoUtils.js';

const CATALOG = {
  Paige: '/technicians/paige.jpeg',
  'Lee G': '/technicians/lee_g.jpeg',
  'Lee P': '/technicians/lee_p.jpeg',
  'Chris M': '/technicians/chris_m.jpeg',
  Jack: '/technicians/jack.jpeg',
  Jay: '/technicians/jay.jpg',
  Josh: '/technicians/josh.jpg',
  Mike: '/technicians/mike.jpg',
  Matt: '/technicians/matt.jpg',
  Ian: '/technicians/ian.jpg',
  Justin: '/technicians/justin.jpg',
};

describe('mergeTechnicianPhotoCatalog', () => {
  it('prefers bundled local paths over remote scraped URLs', async () => {
    const { mergeTechnicianPhotoCatalog } = await import('./technicianPhotoUtils.js');
    const merged = mergeTechnicianPhotoCatalog({
      'Lee G': 'https://gshieldpest.com/wrong.jpg',
      'Lee P': 'https://gshieldpest.com/wrong2.jpg',
    });
    expect(merged['Lee G']).toBe('/technicians/lee_g.jpeg');
    expect(merged['Lee P']).toBe('/technicians/lee_p.jpeg');
  });
});

describe('resolveTechnicianPhotoUrl', () => {
  it('resolves verified full-name aliases to canonical display names', () => {
    expect(resolveTechnicianPhotoUrl('Ed Croy', CATALOG)).toBe('/technicians/ed.jpg');
    expect(resolveTechnicianPhotoUrl('Mike Caswell', CATALOG)).toBe('/technicians/mike.jpg');
    expect(resolveTechnicianPhotoUrl('Matt Lavigne', CATALOG)).toBe('/technicians/matt.jpg');
  });

  it('returns exact display-name match', () => {
    expect(resolveTechnicianPhotoUrl('Lee G', CATALOG)).toBe(CATALOG['Lee G']);
    expect(resolveTechnicianPhotoUrl('Chris M', CATALOG)).toBe(CATALOG['Chris M']);
  });

  it('matches FieldRoutes full name via first + last initial for disambiguated catalog keys', () => {
    expect(resolveTechnicianPhotoUrl('Lee Goodwin', CATALOG)).toBe(CATALOG['Lee G']);
    expect(resolveTechnicianPhotoUrl('Lee Porter', CATALOG)).toBe(CATALOG['Lee P']);
    expect(resolveTechnicianPhotoUrl('Chris Miller', CATALOG)).toBe(CATALOG['Chris M']);
  });

  it('does not cross-match similar first names', () => {
    expect(resolveTechnicianPhotoUrl('Lee Goodwin', CATALOG)).not.toBe(CATALOG['Lee P']);
    expect(resolveTechnicianPhotoUrl('Lee Porter', CATALOG)).not.toBe(CATALOG['Lee G']);
    expect(resolveTechnicianPhotoUrl('Jack Smith', CATALOG)).toBe(CATALOG.Jack);
    expect(resolveTechnicianPhotoUrl('Jay Williams', CATALOG)).toBe(CATALOG.Jay);
    expect(resolveTechnicianPhotoUrl('Josh Adams', CATALOG)).toBe(CATALOG.Josh);
    expect(resolveTechnicianPhotoUrl('Mike Torres', CATALOG)).toBe(CATALOG.Mike);
    expect(resolveTechnicianPhotoUrl('Matt Thompson', CATALOG)).toBe(CATALOG.Matt);
  });

  it('does not match Chris M from an unrelated Chris last name', () => {
    expect(resolveTechnicianPhotoUrl('Chris Adams', CATALOG)).toBeNull();
  });

  it('does not confuse Ian and Justin', () => {
    expect(resolveTechnicianPhotoUrl('Ian Smith', CATALOG)).toBe(CATALOG.Ian);
    expect(resolveTechnicianPhotoUrl('Justin Smith', CATALOG)).toBe(CATALOG.Justin);
    expect(resolveTechnicianPhotoUrl('Ian Smith', CATALOG)).not.toBe(CATALOG.Justin);
  });

  it('matches unique single-name catalog entries from FieldRoutes full names', () => {
    expect(resolveTechnicianPhotoUrl('Paige Bullock', CATALOG)).toBe(CATALOG.Paige);
  });

  it('is case insensitive', () => {
    expect(resolveTechnicianPhotoUrl('lee g', CATALOG)).toBe(CATALOG['Lee G']);
    expect(resolveTechnicianPhotoUrl('MIKE TORRES', CATALOG)).toBe(CATALOG.Mike);
  });

  it('returns null when unknown or ambiguous', () => {
    expect(resolveTechnicianPhotoUrl('Unknown Person', CATALOG)).toBeNull();
    expect(resolveTechnicianPhotoUrl('Lee', CATALOG)).toBeNull();
    expect(resolveTechnicianPhotoUrl('Chris', CATALOG)).toBeNull();
  });
});

describe('resolveTechnicianPhoto diagnostics', () => {
  it('logs exact, fallback, and no-match paths', () => {
    const logger = vi.fn();

    resolveTechnicianPhoto('Lee G', CATALOG, { logger });
    resolveTechnicianPhoto('Lee Goodwin', CATALOG, { logger });
    resolveTechnicianPhoto('Nobody Here', CATALOG, { logger });

    expect(logger).toHaveBeenCalledWith(
      '[technician-photo] exact match',
      expect.objectContaining({ techName: 'Lee G', catalogKey: 'Lee G' }),
    );
    expect(logger).toHaveBeenCalledWith(
      '[technician-photo] first-last-initial match',
      expect.objectContaining({ techName: 'Lee Goodwin', catalogKey: 'Lee G' }),
    );
    expect(logger).toHaveBeenCalledWith(
      '[technician-photo] no match',
      expect.objectContaining({ techName: 'Nobody Here' }),
    );
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
