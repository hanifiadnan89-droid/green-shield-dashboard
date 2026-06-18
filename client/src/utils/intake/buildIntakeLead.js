import { prefillEmptyFields } from '../../pages/SendTemplate/customerPrefill.js';

function buildFullName(customer = {}) {
  const first = String(customer.firstName || '').trim();
  const last = String(customer.lastName || '').trim();
  return [first, last].filter(Boolean).join(' ');
}

function buildAddressString(customer = {}) {
  const street = String(customer.serviceAddress || customer.street || '').trim();
  const cityLine = [customer.city, customer.state, customer.zip].filter(Boolean).join(', ');
  return [street, cityLine].filter(Boolean).join('\n');
}

function buildIntelligenceNotes(customer = {}, property = {}) {
  const parts = [];
  if (property.propertyNotes) parts.push(`Property: ${property.propertyNotes}`);
  if (property.salesNotes) parts.push(`Sales: ${property.salesNotes}`);
  if (property.intelligenceNotes) parts.push(`Intelligence: ${property.intelligenceNotes}`);
  if (customer.notes) parts.push(`Intake: ${customer.notes}`);
  return parts.join('\n\n');
}

/**
 * Build a synthetic lead object for Send Template from Intake session data.
 * @param {{ customer: object, property?: object }} session
 */
export function buildLeadFromIntakeSession(session) {
  const customer = session?.customer || {};
  const property = session?.property || {};
  const fullName = buildFullName(customer);

  const lead = {
    row_number: customer.leadRowNumber || null,
    name: fullName,
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    phone: customer.phone || '',
    email: customer.email || '',
    address: buildAddressString(customer),
    reason: customer.serviceType || '',
    notes: customer.serviceTypeCode || customer.serviceType || '',
    status: 'new',
    sent: '',
    stop: '',
    fromIntake: true,
    intake: {
      customer,
      property,
      verifiedAddress: customer.verifiedAddress || customer.formattedAddress || '',
      latitude: customer.latitude ?? property.latitude ?? null,
      longitude: customer.longitude ?? property.longitude ?? null,
      treatmentAcreage: property.treatmentAcreage ?? null,
      treatmentSquareFeet: property.treatmentSquareFeet ?? null,
      propertyUseEstimate: property.propertyUseEstimate || customer.propertyUseEstimate || null,
      propertyConfidence: property.propertyConfidence || customer.propertyConfidence || null,
      additionalContacts: customer.additionalContacts || '',
      intelligenceNotes: buildIntelligenceNotes(customer, property),
      treatmentPolygon: property.treatmentPolygon || [],
    },
  };

  return lead;
}

/**
 * Prefill quote document state from intake metadata.
 */
export function buildIntakeQuotePrefill(lead) {
  const intake = lead?.intake || {};
  const customer = intake.customer || {};
  const property = intake.property || {};

  const street = customer.serviceAddress || customer.street || '';
  const city = customer.city || '';
  const state = customer.state || '';
  const zip = customer.zip || '';
  const cityState = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const notesParts = [];
  if (property.treatmentAcreage != null) {
    notesParts.push(`Estimated treatment acreage: ${property.treatmentAcreage}`);
  }
  if (property.treatmentSquareFeet != null) {
    notesParts.push(`Estimated treatment sq ft: ${property.treatmentSquareFeet}`);
  }
  if (intake.intelligenceNotes) notesParts.push(intake.intelligenceNotes);

  return {
    address: { street, city, state, zip, cityState },
    notes: notesParts.filter(Boolean).join('\n'),
    treatmentAcreage: property.treatmentAcreage ?? null,
    treatmentSquareFeet: property.treatmentSquareFeet ?? null,
    latitude: intake.latitude ?? null,
    longitude: intake.longitude ?? null,
    additionalContacts: customer.additionalContacts || '',
    serviceType: customer.serviceType || '',
  };
}

export function applyIntakeQuotePrefill(existing, lead) {
  const source = buildIntakeQuotePrefill(lead);
  return {
    address: prefillEmptyFields(existing.address || {}, source.address),
    notes: existing.notes || source.notes,
    treatmentAcreage: existing.treatmentAcreage ?? source.treatmentAcreage,
    treatmentSquareFeet: existing.treatmentSquareFeet ?? source.treatmentSquareFeet,
    latitude: existing.latitude ?? source.latitude,
    longitude: existing.longitude ?? source.longitude,
    additionalContacts: existing.additionalContacts || source.additionalContacts,
    serviceType: existing.serviceType || source.serviceType,
  };
}
