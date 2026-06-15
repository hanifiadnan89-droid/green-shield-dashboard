/** Whether the vector Insect Quarterly PDF builder is enabled (server env). */
export function isInsectQuarterlyVectorPdfEnabled() {
  const raw = process.env.INSECT_QUARTERLY_VECTOR_PDF;
  if (raw == null || String(raw).trim() === '') return true;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}
