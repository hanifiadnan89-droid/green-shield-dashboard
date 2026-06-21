import { useEffect, useRef } from 'react';
import { mountIntakeMap3dElement } from './intakeMap3dElement.js';

/**
 * Photorealistic Earth-style 3D map surface (Map3DElement).
 * Visual inspection only — does not replace the 2D map used for drawing.
 */
export default function IntakeMap3dSurface({
  latitude,
  longitude,
  mapType = 'satellite',
  active = false,
  phase = 'surface',
  onReady,
  onFailure,
  className = '',
}) {
  const containerRef = useRef(null);
  const sessionRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    let destroy = () => {};

    (async () => {
      const result = await mountIntakeMap3dElement(container, {
        lat: latitude,
        lng: longitude,
        mapType,
        phase,
      });

      if (session !== sessionRef.current) {
        result.destroy?.();
        return;
      }

      destroy = result.destroy ?? (() => {});

      if (result.ok) {
        onReady?.(result);
      } else {
        onFailure?.(result.reason);
      }
    })();

    return () => {
      sessionRef.current += 1;
      destroy();
    };
  }, [active, latitude, longitude, mapType, phase, onReady, onFailure]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      className={`intake-map-3d-surface ${className}`.trim()}
      aria-label="3D property preview"
    />
  );
}
