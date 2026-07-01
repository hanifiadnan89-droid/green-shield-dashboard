export function buildHealthChecks({ overdueCount, inProgress, errorsCount, replied }) {
  return [
    {
      id: 'followups',
      label: 'Follow-ups on track',
      ok: overdueCount < Math.max(3, inProgress * 0.2),
    },
    {
      id: 'errors',
      label: errorsCount === 0 ? 'No send errors' : `${errorsCount} errors need review`,
      ok: errorsCount === 0,
    },
    {
      id: 'replies',
      label: replied > 0 ? 'Replies flowing' : 'Awaiting first reply',
      ok: replied > 0,
    },
    {
      id: 'n8n',
      label: 'n8n automation active',
      ok: true,
    },
  ];
}

export function buildHealthScore(healthChecks) {
  return Math.round((healthChecks.filter((check) => check.ok).length / healthChecks.length) * 100);
}
