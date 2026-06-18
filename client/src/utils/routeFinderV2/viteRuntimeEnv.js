/**
 * Safe access to Vite import.meta.env from Node scripts and Vitest.
 * V2 scoring/reporting diagnostics use this instead of reading import.meta.env directly.
 */

/**
 * @param {string} name
 * @returns {string|boolean|undefined}
 */
export function readViteEnv(name) {
  if (typeof import.meta !== 'undefined' && import.meta.env && name in import.meta.env) {
    return import.meta.env[name];
  }

  if (typeof process !== 'undefined' && process.env && name in process.env) {
    return process.env[name];
  }

  return undefined;
}

/**
 * @returns {boolean}
 */
export function isViteDevRuntime() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return Boolean(import.meta.env.DEV);
  }

  return false;
}

/**
 * @returns {boolean}
 */
export function isViteProdRuntime() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return Boolean(import.meta.env.PROD);
  }

  return false;
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function isViteEnvFlagEnabled(name) {
  const raw = readViteEnv(name);
  return raw === 'true' || raw === '1';
}
