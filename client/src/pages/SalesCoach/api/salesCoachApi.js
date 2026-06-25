import { api } from '../../../api/client.js';

/**
 * Sales Coach API layer — thin wrapper that keeps Sales Coach components
 * decoupled from the raw api client.
 *
 * All functions return Promises and throw on error (same as api.* conventions).
 */
export const salesCoachApi = {
  /**
   * Invoke a Sales Coach module on the backend.
   *
   * @param {'objectionCoach'|string} module
   * @param {object} params  — module-specific payload
   * @param {string} [sessionId]
   */
  runModule: (module, params, sessionId) =>
    api.salesCoach.runModule({ module, sessionId, ...params }),

  /** Quick feedback: thumbs_up | thumbs_down | save_approved */
  saveFeedback: (body) => api.ai.objectionFeedback(body),

  /** Full sales case outcome save */
  saveOutcome: (body) => api.ai.objectionOutcome(body),
};
