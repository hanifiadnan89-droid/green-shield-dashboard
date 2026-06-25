// Objection Coach — static option lists.
// id values are the backend-accepted identifiers (sent as-is to the API).

export const CATEGORIES = [
  { id: 'price',      label: 'Price / Cost' },
  { id: 'timing',     label: 'Timing / Not Now' },
  { id: 'need',       label: "Don't Need It" },
  { id: 'trust',      label: 'Trust / Skepticism' },
  { id: 'competitor', label: 'Already Have Service' },
  { id: 'think',      label: 'Need to Think / Spouse' },
  { id: 'other',      label: 'Other' },
];

export const SERVICES = [
  { id: 'mosquito',      label: 'Mosquito' },
  { id: 'flea_tick',     label: 'Flea & Tick' },
  { id: 'general_pest',  label: 'General Pest' },
  { id: 'bundle',        label: 'Bundle' },
  { id: 'not_sure',      label: 'Not Sure Yet' },
];

export const PERSONALITIES = [
  { id: 'analytical',    label: 'Analytical' },
  { id: 'friendly',      label: 'Friendly / Chatty' },
  { id: 'skeptical',     label: 'Skeptical' },
  { id: 'rushed',        label: 'In a Rush' },
  { id: 'price_focused', label: 'Price-Focused' },
];

// Outcome IDs are the canonical backend values — used directly in API calls.
export const OUTCOMES = [
  { id: 'sold',      label: 'Sold' },
  { id: 'scheduled', label: 'Appointment Scheduled' },
  { id: 'follow_up', label: 'Follow-up Planned' },
  { id: 'lost',      label: 'Lost — Customer Declined' },
  { id: 'unknown',   label: 'Unknown / Still Open' },
];

// Reason IDs are the canonical backend values — used directly in API calls.
export const REASONS = [
  { id: 'great_response',   label: 'Response landed perfectly' },
  { id: 'price_overcome',   label: 'Overcame price objection' },
  { id: 'built_trust',      label: 'Built trust / credibility' },
  { id: 'compelling_close', label: 'Compelling closing question' },
  { id: 'wrong_approach',   label: 'Wrong approach for this customer' },
  { id: 'too_pushy',        label: 'Too pushy / aggressive' },
  { id: 'price_too_high',   label: 'Price was genuinely too high' },
  { id: 'timing',           label: 'Bad timing — not ready' },
  { id: 'other',            label: 'Other reason' },
];

export const OUTCOME_EMOJI = {
  sold:      '🎉',
  scheduled: '📅',
  follow_up: '📞',
  lost:      '😔',
  unknown:   '🔄',
};
