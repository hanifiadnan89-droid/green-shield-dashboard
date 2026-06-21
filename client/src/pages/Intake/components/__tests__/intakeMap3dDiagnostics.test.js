import { describe, expect, it } from 'vitest';
import {
  get3dFallbackMessage,
  INTAKE_3D_CSP_FALLBACK_MESSAGE,
  INTAKE_3D_FALLBACK_MESSAGE,
} from '../intakeMap3dDiagnostics.js';

describe('intakeMap3dDiagnostics', () => {
  it('returns CSP-specific fallback when policy blocks 3D', () => {
    expect(get3dFallbackMessage('csp_blocked')).toBe(INTAKE_3D_CSP_FALLBACK_MESSAGE);
  });

  it('returns property fallback for other 3D failures', () => {
    expect(get3dFallbackMessage('vector_mode_unavailable')).toBe(INTAKE_3D_FALLBACK_MESSAGE);
    expect(get3dFallbackMessage('tilt_zero_at_location')).toBe(INTAKE_3D_FALLBACK_MESSAGE);
  });
});
