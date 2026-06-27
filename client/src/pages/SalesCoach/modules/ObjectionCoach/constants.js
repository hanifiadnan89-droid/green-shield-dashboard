// Objection Coach — static option lists.
// id values are the backend-accepted identifiers (sent as-is to the API).

export const CATEGORIES = [
  { id: 'price',    label: 'Price / Cost' },
  { id: 'trust',    label: 'Trust / Skepticism' },
  { id: 'think',    label: 'Need to Think / Spouse' },
  { id: 'shopping', label: 'Still Shopping' },
];

export const SERVICES = [
  { id: 'tick_mosquito',          label: 'Tick & Mosquito' },
  { id: 'insect_quarterly',       label: 'Insect Quarterly' },
  { id: 'rodent_insect_triannual', label: 'Rodent & Insect Triannual' },
  { id: 'bed_bug',                label: 'Bed Bug' },
  { id: 'commercial_monthly',     label: 'Commercial Monthly' },
  { id: 'commercial_bimonthly',   label: 'Commercial Bi-Monthly' },
  { id: 'commercial_quarterly',   label: 'Commercial Quarterly' },
  { id: 'commercial_triannual',   label: 'Commercial Triannual' },
  { id: 'commercial_custom',      label: 'Commercial Custom' },
  { id: 'residential_custom',     label: 'Residential Custom' },
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
