import helmet from 'helmet';

/**
 * Content-Security-Policy for the dashboard SPA.
 * Extends Helmet defaults with domains required for Route Finder maps
 * and technician headshots — no global wildcards.
 */
export function buildContentSecurityPolicyDirectives() {
  const defaults = helmet.contentSecurityPolicy.getDefaultDirectives();

  return {
    ...defaults,
    'script-src': [
      "'self'",
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
    ],
    'connect-src': [
      "'self'",
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://weather.googleapis.com',
      'https://addressvalidation.googleapis.com',
      // Map tile / satellite imagery requests
      'https://khms0.googleapis.com',
      'https://khms1.googleapis.com',
      'https://khms2.googleapis.com',
      'https://khms3.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
      'https://*.googleusercontent.com',
      'https://gshieldpest.com',
      'https://www.gshieldpest.com',
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
    // Google Maps JS API uses blob workers for some map features
    'worker-src': ["'self'", 'blob:'],
  };
}

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: buildContentSecurityPolicyDirectives(),
    },
  });
}
