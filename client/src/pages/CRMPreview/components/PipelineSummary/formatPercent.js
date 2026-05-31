export const formatPercent = v => `${Math.round(Math.min(Math.max(+(v ?? 0), 0), 100))}%`;
