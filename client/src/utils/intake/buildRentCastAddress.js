export function buildRentCastAddress(customer = {}) {
  const street = customer.serviceAddress || customer.street || '';
  const city = customer.city || '';
  const state = customer.state || '';
  const zip = customer.zip || '';

  if (street && city && state && zip) {
    return {
      street,
      city,
      state,
      zip,
      address: `${street}, ${city}, ${state}, ${zip}`,
    };
  }

  const fallback = customer.verifiedAddress || customer.formattedAddress || '';
  return {
    street: street || undefined,
    city: city || undefined,
    state: state || undefined,
    zip: zip || undefined,
    address: fallback || undefined,
  };
}
