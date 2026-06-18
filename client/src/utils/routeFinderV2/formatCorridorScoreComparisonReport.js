/**
 * Markdown-friendly corridor failure score comparison report.
 */

/**
 * @param {import('./validationFailureScoreComparison.js').FailureScoreComparison} row
 * @returns {string[]}
 */
export function formatCorridorScoreComparisonSummary(row) {
  const expected = row.expected;
  const winner = row.winner;
  const lines = [
    `### ${row.exampleId} (${row.routeDate})`,
    `- **Corridor:** ${describeCorridor(row.exampleId)}`,
    `- **Expected:** ${row.expectedTechName} | **Winner:** ${row.winningTechName}`,
    `- **Expected adjusted score:** ${expected?.adjustedTotal ?? '—'}`,
    `- **Winner adjusted score:** ${winner?.adjustedTotal ?? '—'}`,
    `- **Score delta (winner − expected):** ${row.finalScoreDelta ?? '—'}`,
    '',
    '| Component | Expected | Winner | Δ (winner − expected) |',
    '| --- | ---: | ---: | ---: |',
  ];

  const metrics = [
    ['Base total', expected?.baseTotal, winner?.baseTotal],
    ['Adjusted total', expected?.adjustedTotal, winner?.adjustedTotal],
    ['Geo cluster bonus', expected?.geoClusterBonus, winner?.geoClusterBonus],
    ['Geo cluster penalty', expected?.geoClusterPenalty, winner?.geoClusterPenalty],
    ['Same town bonus', expected?.sameTownBonus, winner?.sameTownBonus],
    ['Nearby route bonus', expected?.nearbyRouteBonus, winner?.nearbyRouteBonus],
    ['Normal service area bonus', expected?.normalServiceAreaBonus, winner?.normalServiceAreaBonus],
    ['Territory owner bonus', expected?.territoryOwnerBonus, winner?.territoryOwnerBonus],
    ['Neighboring territory penalty', expected?.neighboringTerritoryPenalty, winner?.neighboringTerritoryPenalty],
    ['Backtracking penalty', expected?.backtrackingPenalty, winner?.backtrackingPenalty],
    ['Stop load penalty', expected?.stopLoadPenalty, winner?.stopLoadPenalty],
    ['Workload penalty (base)', expected?.workloadPenalty, winner?.workloadPenalty],
    ['Stop count', expected?.stopCount, winner?.stopCount],
    ['V2 rank', expected?.rank, winner?.rank],
  ];

  for (const [label, left, right] of metrics) {
    const delta = Number(right ?? 0) - Number(left ?? 0);
    lines.push(`| ${label} | ${left ?? '—'} | ${right ?? '—'} | ${delta > 0 ? '+' : ''}${delta} |`);
  }

  lines.push(
    '',
    `**Why winner outranked expected:** ${row.whyWinnerWon}`,
    '',
    `**Expected base breakdown:** ${expected ? formatBaseBreakdown(expected) : '—'}`,
    `**Winner base breakdown:** ${winner ? formatBaseBreakdown(winner) : '—'}`,
    `**Expected adjusted breakdown:** ${formatAdjustedBreakdown(expected)}`,
    `**Winner adjusted breakdown:** ${formatAdjustedBreakdown(winner)}`,
    '',
  );

  return lines;
}

/**
 * @param {import('./validationFailureScoreComparison.js').FailureScoreComparison[]} comparisons
 * @returns {string}
 */
export function formatCorridorScoreComparisonReport(comparisons = []) {
  const lines = [
    '# Corridor high-confidence failure score breakdown',
    '',
    'Dispatcher-confirmed genuine routing mistakes. No weight tuning applied.',
    '',
  ];

  for (const row of comparisons) {
    lines.push(...formatCorridorScoreComparisonSummary(row));
  }

  return lines.join('\n');
}

/**
 * @param {string} exampleId
 * @returns {string}
 */
function describeCorridor(exampleId) {
  if (exampleId.includes('scarborough')) return 'Scarborough — Paige should own Greater Portland corridor';
  if (exampleId.includes('old-orchard')) return 'Old Orchard — OOB techs (Ian/Patrick) should beat Portland-area pulls';
  if (exampleId.includes('windham')) return 'Windham — Chris/Paige should beat Midcoast/Freeport pulls';
  return 'Greater Portland / Cumberland corridor';
}

/**
 * @param {import('./validationFailureScoreComparison.js').TechnicianScoreSnapshot} snapshot
 * @returns {string}
 */
function formatBaseBreakdown(snapshot) {
  const b = snapshot.baseScoreBreakdown;
  return `geo ${b.geographic}, travel ${b.travelEfficiency}, window ${b.timeWindow}, workload ${b.workload}, svcDur ${b.serviceDuration}, cap ${b.capacity}, insProx ${b.insertionProximity}, areaBonus ${b.routeAreaBonus}, workloadPen ${b.workloadPenalty}`;
}

/**
 * @param {import('./validationFailureScoreComparison.js').TechnicianScoreSnapshot|null|undefined} snapshot
 * @returns {string}
 */
function formatAdjustedBreakdown(snapshot) {
  if (!snapshot) return '—';
  const bonusText = snapshot.bonuses.length
    ? snapshot.bonuses.map(item => `${item.code} +${item.points}`).join(', ')
    : 'none';
  const penaltyText = snapshot.penalties.length
    ? snapshot.penalties.map(item => `${item.code} -${item.points}`).join(', ')
    : 'none';
  return `bonuses: ${bonusText}; penalties: ${penaltyText}`;
}
