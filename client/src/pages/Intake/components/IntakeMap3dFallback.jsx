import { INTAKE_3D_FALLBACK_MESSAGE } from './intakeMap3dDiagnostics.js';

export default function IntakeMap3dFallback({ message = INTAKE_3D_FALLBACK_MESSAGE }) {
  if (!message) return null;

  return (
    <p className="intake-map-3d-fallback" role="status">
      {message}
    </p>
  );
}
