function getIntakeMapId() {
  return (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim() || null;
}

export const INTAKE_3D_FALLBACK_MESSAGE =
  '3D Preview unavailable for this property. Showing satellite view.';

export const INTAKE_3D_CSP_FALLBACK_MESSAGE =
  '3D Preview unavailable due to browser/security policy. Satellite view is still available.';

export function get3dFallbackMessage(reason) {
  if (reason === 'csp_blocked') return INTAKE_3D_CSP_FALLBACK_MESSAGE;
  return INTAKE_3D_FALLBACK_MESSAGE;
}

export function createCspViolationTracker() {
  const violations = [];

  const handler = (event) => {
    violations.push({
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
    });
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('securitypolicyviolation', handler);
  }

  return {
    getViolations: () => violations.slice(),
    hasMaps3dViolation() {
      return violations.some((v) => {
        const uri = `${v.blockedURI || ''}`;
        const directive = `${v.effectiveDirective || v.violatedDirective || ''}`;
        return uri.includes('gstatic')
          || uri.includes('googleapis')
          || uri.includes('wasm')
          || uri.includes('webgl')
          || directive.includes('script-src')
          || directive.includes('worker-src')
          || directive.includes('child-src');
      });
    },
    stop() {
      if (typeof document !== 'undefined') {
        document.removeEventListener('securitypolicyviolation', handler);
      }
    },
  };
}

export function readMap3dState(map, maps) {
  const renderingType = map?.getRenderingType?.();
  const vectorEnum = maps?.RenderingType?.VECTOR ?? null;
  const rasterEnum = maps?.RenderingType?.RASTER ?? null;

  return {
    mapIdPresent: Boolean(getIntakeMapId()),
    configuredMapId: getIntakeMapId(),
    renderingType: renderingType ?? null,
    renderingTypeVector: vectorEnum,
    renderingTypeRaster: rasterEnum,
    isVectorRendering: vectorEnum != null && renderingType === vectorEnum,
    tilt: Number(map?.getTilt?.() ?? 0),
    heading: Number(map?.getHeading?.() ?? 0),
    mapTypeId: map?.getMapTypeId?.() ?? null,
    zoom: map?.getZoom?.() ?? null,
    hasSetTilt: typeof map?.setTilt === 'function',
    hasSetHeading: typeof map?.setHeading === 'function',
  };
}

export function describe3dFallbackReason(reason, state) {
  switch (reason) {
    case 'no_map_id':
      return 'VITE_GOOGLE_MAP_ID is missing from the built client';
    case 'no_map_instance':
      return 'Map instance is not ready';
    case 'set_options_failed':
      return 'Google Maps rejected 3D options';
    case 'no_vector_rendering_type':
      return 'RenderingType.VECTOR is unavailable in this Maps API build';
    case 'vector_mode_unavailable':
      return `Map stayed on raster rendering (renderingType=${state?.renderingType ?? 'unknown'})`;
    case 'tilt_zero_at_location':
      return `Tilt remained 0 after apply (zoom=${state?.zoom ?? '?'}, mapTypeId=${state?.mapTypeId ?? '?'})`;
    case 'tilt_timeout':
      return 'Timed out waiting for vector map idle/tilt';
    case 'csp_blocked':
      return 'Content Security Policy blocked Maps WebGL/WebAssembly (unsafe-eval, wasm, or workers)';
    default:
      return reason || 'Unknown 3D preview failure';
  }
}

export function logIntake3dDiagnostics(phase, { before, after, ok, reason, extra = {} }) {
  const fallbackReason = ok ? null : describe3dFallbackReason(reason, after || before);

  console.group(`[Intake 3D Preview] ${phase}`);
  console.log('mapId present (built client):', Boolean(getIntakeMapId()), getIntakeMapId() || '(empty)');
  console.log('3D support / fallback reason:', ok ? 'applied' : fallbackReason);
  console.log('before:', before);
  console.log('after:', after);
  if (Object.keys(extra).length > 0) console.log('extra:', extra);
  console.groupEnd();

  return fallbackReason;
}
