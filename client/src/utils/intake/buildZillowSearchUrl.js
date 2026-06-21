import { formatDisplayAddress } from './formatDisplayAddress.js';

function zip5(zip) {
  return String(zip || '').replace(/\D/g, '').slice(0, 5);
}

function slugifyToken(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
}

function buildZillowSlugFromParts({ street, city, state, zip }) {
  const streetSlug = slugifyToken(street);
  const citySlug = slugifyToken(city);
  const statePart = String(state || '').trim().toUpperCase();
  const zipPart = zip5(zip);

  if (!streetSlug || !citySlug || !statePart || !zipPart) return null;
  return `${streetSlug},-${citySlug},-${statePart}-${zipPart}`;
}

function parseAddressFromString(address) {
  const normalized = formatDisplayAddress(address);
  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;

  const street = parts[0];
  const city = parts[1];
  const stateZipMatch = parts[2].match(/^([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/);
  if (!stateZipMatch) return null;

  return {
    street,
    city,
    state: stateZipMatch[1],
    zip: stateZipMatch[2],
  };
}

function buildFallbackSlug(address) {
  const normalized = formatDisplayAddress(address);
  if (!normalized) return null;

  const slug = normalized
    .replace(/\s+/g, '-')
    .replace(/,\s*/g, ',-')
    .replace(/[^a-zA-Z0-9,-]/g, '');

  return slug || null;
}

/**
 * Build a Zillow search URL for manual rep review. Does not fetch Zillow data.
 * Uses the /homes/{address-slug}_rb/ search pattern.
 */
export function buildZillowSearchUrl(source = {}) {
  const componentSlug = buildZillowSlugFromParts({
    street: source.serviceAddress || source.street,
    city: source.city,
    state: source.state,
    zip: source.zip,
  });

  if (componentSlug) {
    return `https://www.zillow.com/homes/${componentSlug}_rb/`;
  }

  const address = source.verifiedAddress
    || source.formattedAddress
    || [source.serviceAddress, source.city, source.state, source.zip].filter(Boolean).join(', ');

  if (!address) return null;

  const parsedSlug = buildZillowSlugFromParts(parseAddressFromString(address) || {});
  if (parsedSlug) {
    return `https://www.zillow.com/homes/${parsedSlug}_rb/`;
  }

  const fallbackSlug = buildFallbackSlug(address);
  if (!fallbackSlug) return null;

  return `https://www.zillow.com/homes/${fallbackSlug}_rb/`;
}
