export function buildRentCastAddress(customer = {}) {
  const street = customer.serviceAddress || customer.street || '';
  const city = customer.city || '';
  const state = customer.state || '';
  const zip = customer.zip || '';
  const verifiedAddress = customer.verifiedAddress || customer.formattedAddress || '';

  if (street && city && state && zip) {
    return {
      street,
      city,
      state,
      zip,
      verifiedAddress: verifiedAddress || undefined,
      address: `${street}, ${city}, ${state}, ${zip}`,
    };
  }

  return {
    street: street || undefined,
    city: city || undefined,
    state: state || undefined,
    zip: zip || undefined,
    verifiedAddress: verifiedAddress || undefined,
    address: verifiedAddress || undefined,
  };
}
