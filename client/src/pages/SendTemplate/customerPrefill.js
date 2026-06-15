import { parseCityStateZip } from './bedBugAgreementUtils.js';

function buildCityStateZip({ city, state, zip }) {
  const parts = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

/**
 * Parse a free-form address string from the lead record into structured fields.
 */
export function parseLeadAddress(lead) {
  const raw = String(lead?.address ?? '').trim();
  if (!raw) {
    return { street: '', city: '', state: '', zip: '', cityState: '' };
  }

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const street = lines[0];
    const parsed = parseCityStateZip(lines.slice(1).join(', '));
    return {
      street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      cityState: buildCityStateZip(parsed),
    };
  }

  const commaParts = raw.split(',').map((part) => part.trim());
  if (commaParts.length >= 3) {
    const street = commaParts[0];
    const parsed = parseCityStateZip(commaParts.slice(1).join(', '));
    return {
      street,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      cityState: buildCityStateZip(parsed),
    };
  }

  const parsed = parseCityStateZip(raw);
  if (parsed.city && (parsed.state || parsed.zip)) {
    return {
      street: '',
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      cityState: buildCityStateZip(parsed),
    };
  }

  return {
    street: raw,
    city: '',
    state: '',
    zip: '',
    cityState: '',
  };
}

/** Fill empty address fields from lead customer data without overwriting user edits. */
export function buildCustomerAddressFromLead(lead, existing = {}) {
  const fromLead = parseLeadAddress(lead);
  const parsed = parseCityStateZip(existing.cityState ?? '');

  const city = existing.city || parsed.city || fromLead.city;
  const state = existing.state || parsed.state || fromLead.state;
  const zip = existing.zip || parsed.zip || fromLead.zip;

  return {
    street: existing.street || fromLead.street || '',
    city,
    state,
    zip,
    cityState: existing.cityState || buildCityStateZip({ city, state, zip }) || fromLead.cityState,
  };
}

/** Fill empty string fields on target from source values. */
export function prefillEmptyFields(target, source) {
  const out = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (!String(out[key] ?? '').trim() && String(value ?? '').trim()) {
      out[key] = value;
    }
  }
  return out;
}
