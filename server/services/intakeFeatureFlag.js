/** Whether Intake sales flow API routes are enabled (server env). */
export function isIntakeEnabled() {
  const raw = process.env.INTAKE_ENABLED;
  if (raw == null || String(raw).trim() === '') return true;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}
