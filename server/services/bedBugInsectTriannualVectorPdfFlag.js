/** Whether the vector Bed Bug & Insect Triannual PDF builder is enabled (server env). */
export function isBedBugInsectTriannualVectorPdfEnabled() {
  const raw = String(process.env.BED_BUG_INSECT_TRIANNUAL_VECTOR_PDF ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}
