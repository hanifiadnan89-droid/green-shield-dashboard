/**
 * Format a verified address for display on Property Intelligence.
 * Strips ZIP+4 suffix and trailing country while preserving full value in session state.
 */
export function formatDisplayAddress(address) {
  if (!address || typeof address !== 'string') return address || '';

  let display = address.trim();
  display = display.replace(/,\s*(USA|United States|U\.S\.A\.|US)\s*$/i, '');
  display = display.replace(/(\d{5})-\d{4}/g, '$1');
  return display.replace(/\s+,/g, ',').replace(/,\s*$/, '').trim();
}
