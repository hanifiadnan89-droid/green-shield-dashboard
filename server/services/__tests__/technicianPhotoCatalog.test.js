import { describe, it, expect } from 'vitest';
import {
  extractTeamNameOrder,
  extractTechnicianNames,
  buildTechnicianCatalog,
  TECHNICIAN_SECTION_MARKERS,
} from '../technicianPhotoCatalog.js';

const SAMPLE_HTML = `
  <h3>Meet the Team</h3>
  <h3>Colby Thayer</h3>
  <h3>Greg England</h3>
  <h3>Spencer</h3>
  <h3>Lee G</h3>
  <h3>Lee P</h3>
  <h3>Chris M</h3>
  <h3>Alex</h3>
  <h3>Matt</h3>
  <h3>Adnan</h3>
`;

const ALL_NAMES = extractTeamNameOrder(SAMPLE_HTML);
const PHOTOS = Array.from({ length: 10 }, (_, i) => ({
  num: i + 1,
  url: `https://gshieldpest.com/wp-content/uploads/2025/04/greenshieldcompanyheadshots25-${String(i + 1).padStart(2, '0')}.jpg`,
}));

describe('technicianPhotoCatalog', () => {
  it('extracts technician section names preserving Lee G and Lee P', () => {
    const technicians = extractTechnicianNames(ALL_NAMES);
    expect(technicians[0]).toBe(TECHNICIAN_SECTION_MARKERS.start);
    expect(technicians).toContain('Lee G');
    expect(technicians).toContain('Lee P');
    expect(technicians).toContain('Chris M');
    expect(technicians[technicians.length - 1]).toBe(TECHNICIAN_SECTION_MARKERS.end);
    expect(technicians).not.toContain('Adnan');
    expect(technicians).not.toContain('Spencer');
  });

  it('maps technicians by global About-page order, not entire staff list', () => {
    const { byName, technicians } = buildTechnicianCatalog(ALL_NAMES, PHOTOS);

    expect(technicians).toEqual(['Lee G', 'Lee P', 'Chris M', 'Alex', 'Matt']);
    expect(byName['Lee G']).toContain('headshots25-04');
    expect(byName['Lee P']).toContain('headshots25-05');
    expect(byName['Chris M']).toContain('headshots25-06');
    expect(byName.Matt).toContain('headshots25-08');
    expect(byName.Adnan).toBeUndefined();
  });
});
