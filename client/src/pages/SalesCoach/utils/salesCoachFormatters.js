import { OUTCOMES, REASONS, OUTCOME_EMOJI } from '../modules/ObjectionCoach/constants.js';

export function getOutcomeLabel(outcomeId) {
  return OUTCOMES.find(o => o.id === outcomeId)?.label ?? outcomeId;
}

export function getReasonLabel(reasonId) {
  return REASONS.find(r => r.id === reasonId)?.label ?? reasonId;
}

export function getOutcomeEmoji(outcomeId) {
  return OUTCOME_EMOJI[outcomeId] ?? '✓';
}

/** Maps a numeric confidence score to 'high' | 'medium' | 'low'. */
export function confidenceLevel(score) {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/** Human-readable relative timestamp, e.g. "5m ago" or "Jul 4". */
export function formatSessionTimestamp(isoString) {
  const date    = new Date(isoString);
  const diffMs  = Date.now() - date;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Returns a short human-readable module name for display. */
export function getModuleLabel(moduleId) {
  const MAP = {
    objectionCoach: 'Objection Coach',
    pricingCoach:   'Pricing Coach',
    closingCoach:   'Closing Coach',
    followUpCoach:  'Follow-Up Coach',
    callStrategy:   'Call Strategy',
    playbooks:      'Playbooks',
  };
  return MAP[moduleId] ?? moduleId;
}
