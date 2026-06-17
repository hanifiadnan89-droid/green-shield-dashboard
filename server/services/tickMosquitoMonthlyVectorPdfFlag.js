/** Whether the vector Tick & Mosquito Monthly PDF builder is enabled (server env). */
export function isTickMosquitoMonthlyVectorPdfEnabled() {
  const raw = process.env.TICK_MOSQUITO_MONTHLY_VECTOR_PDF;
  if (raw == null || String(raw).trim() === '') return true;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}
