import { describe, it, expect } from 'vitest';
import { buildLeadFromIntakeSession, buildIntakeQuotePrefill } from '../buildIntakeLead.js';

describe('buildIntakeLead', () => {
  const session = {
    customer: {
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '207-555-0100',
      email: 'jane@example.com',
      serviceAddress: '123 Main St',
      city: 'Saco',
      state: 'ME',
      zip: '04072',
      serviceType: 'Tick & Mosquito',
      notes: 'Caller wants backyard treated',
      latitude: 43.5,
      longitude: -70.4,
      verifiedAddress: '123 Main St, Saco, ME 04072',
    },
    property: {
      treatmentAcreage: 0.42,
      treatmentSquareFeet: 18295,
      propertyNotes: 'Wooded edge',
      salesNotes: 'Ready to sign',
      intelligenceNotes: 'High deer activity',
    },
  };

  it('builds a synthetic lead with intake metadata', () => {
    const lead = buildLeadFromIntakeSession(session);
    expect(lead.name).toBe('Jane Doe');
    expect(lead.fromIntake).toBe(true);
    expect(lead.address).toContain('123 Main St');
    expect(lead.intake.treatmentAcreage).toBe(0.42);
    expect(lead.intake.intelligenceNotes).toContain('Wooded edge');
  });

  it('builds quote prefill with acreage and notes', () => {
    const lead = buildLeadFromIntakeSession(session);
    const prefill = buildIntakeQuotePrefill(lead);
    expect(prefill.address.street).toBe('123 Main St');
    expect(prefill.treatmentAcreage).toBe(0.42);
    expect(prefill.notes).toContain('Estimated treatment acreage');
  });
});
