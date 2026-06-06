export const ROUTE_AREA_LABELS = {
  new_hampshire: 'New Hampshire Route',
  maine: 'Maine Route',
};

export const RANK_COLORS = ['#16A34A', '#3B82F6', '#8B5CF6'];

export const TIMED_RISK_CFG = {
  none: { label: '✓ timed safe', color: '#16A34A' },
  low: { label: '⚡ low risk', color: '#F59E0B' },
  medium: { label: '⚠ timed risk', color: '#F59E0B' },
  high: { label: '✗ timed conflict', color: '#DC2626' },
};

export const SMOOTHNESS_CFG = {
  'Smooth fit': { color: '#16A34A', icon: '✓' },
  'Minor adjustment': { color: '#F59E0B', icon: '~' },
  'Tight gap': { color: '#F59E0B', icon: '⚡' },
  'Some disruption': { color: '#F59E0B', icon: '⚠' },
  'Difficult fit': { color: '#DC2626', icon: '✗' },
};

export const BT_RISK_CFG = {
  None: { color: '#16A34A', icon: '✓' },
  Low: { color: '#F59E0B', icon: '~' },
  Moderate: { color: '#F59E0B', icon: '⚠' },
  High: { color: '#DC2626', icon: '✗' },
  Severe: { color: '#DC2626', icon: '✗' },
};

export const CONF_CFG = {
  High: { color: '#16A34A' },
  Medium: { color: '#F59E0B' },
  Low: { color: '#94A3B8' },
};

export const SCORE_BREAKDOWN = [
  { key: 'geographic', label: 'Geo Match' },
  { key: 'travelEfficiency', label: 'Drive Impact' },
  { key: 'timeWindow', label: 'Win Opportunity' },
  { key: 'capacity', label: 'Capacity Impact' },
  { key: 'insertionProximity', label: 'Insurance Compatibility' },
];

export function matchLayoutId(match) {
  return `route-match-${match.matchId ?? match.routeId}`;
}
