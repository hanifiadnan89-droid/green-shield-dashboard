/** Whether the vector Insect Quarterly PDF builder is enabled (server env). */
export function isInsectQuarterlyVectorPdfEnabled() {
  const raw = String(process.env.INSECT_QUARTERLY_VECTOR_PDF ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}
