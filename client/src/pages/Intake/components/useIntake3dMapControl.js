import { useCallback, useRef, useState } from 'react';
import { get3dFallbackMessage, INTAKE_3D_SIMPLE_FALLBACK } from './intakeMap3dDiagnostics.js';
import { verify3dPreviewOnMap } from './intakeMapConfig.js';

/**
 * One-shot 3D toggle control: no retry loop after failure, stable 2D fallback.
 */
export function useIntake3dMapControl({ enable3d, setEnable3d }) {
  const [preview3dFallback, setPreview3dFallback] = useState(null);
  const [preview3dBlocked, setPreview3dBlocked] = useState(false);
  const verifyGenerationRef = useRef(0);
  const verifyInFlightRef = useRef(false);

  const requestEnable3d = useCallback((next) => {
    if (next && preview3dBlocked) {
      setPreview3dFallback(INTAKE_3D_SIMPLE_FALLBACK);
      return;
    }
    if (!next) {
      setPreview3dFallback(null);
    }
    setEnable3d(next);
  }, [preview3dBlocked, setEnable3d]);

  const verifyAfter3dInit = useCallback(async (map, maps, phase) => {
    if (!enable3d || preview3dBlocked || verifyInFlightRef.current) return;

    const generation = verifyGenerationRef.current;
    verifyInFlightRef.current = true;

    try {
      const result = await verify3dPreviewOnMap(map, maps, { phase });
      if (generation !== verifyGenerationRef.current) return;

      if (!result.ok) {
        setPreview3dBlocked(true);
        setPreview3dFallback(get3dFallbackMessage(result.reason));
        verifyGenerationRef.current += 1;
        setEnable3d(false);
      } else {
        setPreview3dFallback(null);
      }
    } finally {
      verifyInFlightRef.current = false;
    }
  }, [enable3d, preview3dBlocked, setEnable3d]);

  const invalidateVerify = useCallback(() => {
    verifyGenerationRef.current += 1;
  }, []);

  return {
    preview3dFallback,
    preview3dBlocked,
    requestEnable3d,
    verifyAfter3dInit,
    invalidateVerify,
    canShow3dButton: (can3d) => can3d && !preview3dBlocked,
  };
}
