/** Whether the vector Rodent & Insect Triannual PDF builder is enabled (server env). */
export function isRodentInsectTriannualVectorPdfEnabled() {
  const raw = String(process.env.RODENT_INSECT_TRIANNUAL_VECTOR_PDF ?? '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}
