/**
 * Separates trailing account numbers embedded in customer names.
 * e.g. "Susanne Stavis 16051" → { displayName: "Susanne Stavis", accountNumber: "16051" }
 */
const TRAILING_ACCOUNT_RE = /^(.+?)\s+(?:#?|acct\.?\s*)?(\d{4,})\s*$/i;

export function parseLeadName(rawName) {
  const raw = String(rawName || '').trim();
  if (!raw) {
    return { displayName: '', accountNumber: null, rawName: '' };
  }

  const match = raw.match(TRAILING_ACCOUNT_RE);
  if (!match) {
    return { displayName: raw, accountNumber: null, rawName: raw };
  }

  const displayName = match[1].trim();
  const accountNumber = match[2];

  if (!displayName) {
    return { displayName: raw, accountNumber: null, rawName: raw };
  }

  return { displayName, accountNumber, rawName: raw };
}
