import { isViteEnvFlagEnabled } from '../routeFinderV2/viteRuntimeEnv.js';

/** Whether the Intake sales flow is enabled in the client build. */
export function isIntakeEnabled() {
  return isViteEnvFlagEnabled('VITE_INTAKE_ENABLED');
}
