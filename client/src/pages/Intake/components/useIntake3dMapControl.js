import { useCallback, useRef, useState } from 'react';
import { INTAKE_3D_PHOTOREAL_FALLBACK } from './intakeMap3dElement.js';
import { INTAKE_3D_SIMPLE_FALLBACK } from './intakeMap3dDiagnostics.js';

/**
 * One-shot 3D toggle control for Map3DElement photorealistic preview.
 */
export function useIntake3dMapControl({ enable3d, setEnable3d }) {
  const [preview3dFallback, setPreview3dFallback] = useState(null);
  const [preview3dBlocked, setPreview3dBlocked] = useState(false);
  const handledFailureRef = useRef(false);

  const requestEnable3d = useCallback((next) => {
    if (next && preview3dBlocked) {
      setPreview3dFallback(INTAKE_3D_SIMPLE_FALLBACK);
      return;
    }
    if (!next) {
      handledFailureRef.current = false;
      setPreview3dFallback(null);
    }
    setEnable3d(next);
  }, [preview3dBlocked, setEnable3d]);

  const handle3dSurfaceReady = useCallback(() => {
    handledFailureRef.current = false;
    setPreview3dFallback(null);
  }, []);

  const handle3dSurfaceFailure = useCallback((reason) => {
    if (handledFailureRef.current || preview3dBlocked) return;
    handledFailureRef.current = true;
    setPreview3dBlocked(true);
    setPreview3dFallback(
      reason === 'maps3d_load_failed' || reason === 'gmp_error' || reason === 'init_timeout'
        ? INTAKE_3D_PHOTOREAL_FALLBACK
        : INTAKE_3D_SIMPLE_FALLBACK,
    );
    setEnable3d(false);
  }, [preview3dBlocked, setEnable3d]);

  return {
    preview3dFallback,
    preview3dBlocked,
    requestEnable3d,
    handle3dSurfaceReady,
    handle3dSurfaceFailure,
    canShow3dButton: (can3d) => can3d && !preview3dBlocked,
  };
}
