export const TRAINING_TABS = [
  { id: 'principle',         label: 'Sales Principles' },
  { id: 'approved_response', label: 'Approved Responses' },
  { id: 'correction',        label: 'Corrections' },
  { id: 'objection_example', label: 'Objection Examples' },
  { id: 'playbook_seed',     label: 'Playbook Seeds' },
  { id: 'sessions',          label: 'Session History' },
];

export const TYPE_CONFIG = {
  principle: {
    titleLabel:      'Principle Title',
    titlePlaceholder: 'e.g. Lead with value, not price',
    contentLabel:    'Principle',
    contentPlaceholder: 'Describe the principle and why it works in Green Shield sales calls.',
    contextLabel:    'When to apply (optional)',
    contextPlaceholder: 'e.g. When customer raises price objection early in the call',
    description: 'Core sales beliefs and mental models. Always included in every AI coaching response.',
  },
  approved_response: {
    titleLabel:      'Response Title',
    titlePlaceholder: 'e.g. Handling price shock on T/M program',
    contentLabel:    'Approved Response',
    contentPlaceholder: 'The exact wording or response style that has been approved.',
    contextLabel:    'Context / When to use (optional)',
    contextPlaceholder: 'e.g. Customer says $119/month is too much — first call, no prior service',
    description: 'Word-for-word responses or scripts that have been approved by the sales manager.',
  },
  correction: {
    titleLabel:      'What to Avoid',
    titlePlaceholder: 'e.g. Don\'t apologize for pricing',
    contentLabel:    'Better Approach',
    contentPlaceholder: 'What should the rep do instead? Be specific.',
    contextLabel:    'Why this matters (optional)',
    contextPlaceholder: 'e.g. Apologizing signals lack of confidence and invites further negotiation',
    description: 'Common mistakes and what to do instead. Helps AI avoid repeating bad patterns.',
  },
  objection_example: {
    titleLabel:      'Objection Summary',
    titlePlaceholder: 'e.g. "I need to check with my wife first"',
    contentLabel:    'How to Handle It',
    contentPlaceholder: 'Walk through how to address this specific objection.',
    contextLabel:    'Service / Context (optional)',
    contextPlaceholder: 'e.g. T/M program, end of call, spouse not present',
    description: 'Specific objections and how to handle them. Used to match similar situations.',
  },
  playbook_seed: {
    titleLabel:      'Strategy Name',
    titlePlaceholder: 'e.g. Seasonal urgency close',
    contentLabel:    'Strategy',
    contentPlaceholder: 'Describe the playbook strategy in detail.',
    contextLabel:    'When it works best (optional)',
    contextPlaceholder: 'e.g. May–July when season is just starting and spots are filling up',
    description: 'High-level sales strategies and tactics. Informs coaching angle and framing.',
  },
};

export const OUTCOME_LABELS = {
  sold:       'Sold',
  scheduled:  'Scheduled',
  follow_up:  'Follow Up',
  lost:       'Lost',
  declined:   'Declined',
  unknown:    'Unknown',
};

export const OUTCOME_EMOJI = {
  sold:       '🎉',
  scheduled:  '📅',
  follow_up:  '⏰',
  lost:       '❌',
  declined:   '🚫',
  unknown:    '❓',
};
