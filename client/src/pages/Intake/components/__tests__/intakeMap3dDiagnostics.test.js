import { describe, expect, it } from 'vitest';
import {
  get3dFallbackMessage,
  INTAKE_3D_SIMPLE_FALLBACK,
} from '../intakeMap3dDiagnostics.js';

describe('intakeMap3dDiagnostics', () => {
  it('returns the simple fallback message for all 3D failures', () => {
    expect(get3dFallbackMessage('csp_blocked')).toBe(INTAKE_3D_SIMPLE_FALLBACK);
    expect(get3dFallbackMessage('vector_mode_unavailable')).toBe(INTAKE_3D_SIMPLE_FALLBACK);
    expect(get3dFallbackMessage('tilt_zero_at_location')).toBe(INTAKE_3D_SIMPLE_FALLBACK);
  });
});
