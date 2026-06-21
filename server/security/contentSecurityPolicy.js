import helmet from 'helmet';

/**
 * Content-Security-Policy for the dashboard SPA.
 * Extends Helmet defaults with domains required for Route Finder maps,
 * Intake Places (New) autocomplete, technician headshots, and Google Maps
 * vector/WebGL 3D preview (wasm + workers).
 *
 * @see https://developers.google.com/maps/documentation/javascript/content-security-policy
 */
export function buildContentSecurityPolicyDirectives() {
  const defaults = helmet.contentSecurityPolicy.getDefaultDirectives();

  const googleMapsScripts = [
    'https://maps.googleapis.com',
    'https://maps.gstatic.com',
    'https://*.googleapis.com',
    'https://*.gstatic.com',
  ];

  const googleMapsWorkers = [
    'blob:',
    'https://maps.gstatic.com',
    'https://*.gstatic.com',
  ];

  return {
    ...defaults,
    'script-src': [
      "'self'",
      ...googleMapsScripts,
      // Vector/WebGL Maps renderer compiles WebAssembly and uses eval-based loaders.
      "'unsafe-eval'",
      "'wasm-unsafe-eval'",
      'blob:',
    ],
    'connect-src': [
      "'self'",
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://*.googleapis.com',
      'https://*.gstatic.com',
      'https://places.googleapis.com',
      'https://weather.googleapis.com',
      'https://addressvalidation.googleapis.com',
      // Map tile / satellite imagery requests
      'https://khms0.googleapis.com',
      'https://khms1.googleapis.com',
      'https://khms2.googleapis.com',
      'https://khms3.googleapis.com',
      'data:',
      'blob:',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      ...googleMapsScripts,
      'https://*.googleusercontent.com',
      'https://gshieldpest.com',
      'https://www.gshieldpest.com',
    ],
    'frame-src': [
      "'self'",
      ...googleMapsScripts,
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com',
    ],
    'font-src': [
      "'self'",
      'data:',
      'https://fonts.gstatic.com',
    ],
    // Maps vector renderer spawns blob: and gstatic workers (e.g. shared-label-worker.js).
    'worker-src': ["'self'", ...googleMapsWorkers],
    'child-src': ["'self'", ...googleMapsWorkers],
  };
}

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(),
    },
  });
}
