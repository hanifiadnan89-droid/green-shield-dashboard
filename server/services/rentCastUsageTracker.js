const FREE_TIER_MONTHLY = 50;

let usageState = {
  monthKey: currentMonthKey(),
  apiCallsThisMonth: 0,
};

function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function resetIfNewMonth() {
  const monthKey = currentMonthKey();
  if (usageState.monthKey !== monthKey) {
    usageState = { monthKey, apiCallsThisMonth: 0 };
  }
}

export function getMonthlyLookupLimit() {
  const raw = process.env.RENTCAST_MONTHLY_LOOKUP_LIMIT;
  if (raw == null || raw === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

export function recordRentCastApiCall() {
  resetIfNewMonth();
  usageState.apiCallsThisMonth += 1;
  return usageState.apiCallsThisMonth;
}

export function getRentCastUsage() {
  resetIfNewMonth();
  const monthlyLimit = getMonthlyLookupLimit();
  const callsMadeThisMonth = usageState.apiCallsThisMonth;
  const estimatedFreeRemaining = Math.max(0, FREE_TIER_MONTHLY - callsMadeThisMonth);
  const estimatedOverageCalls = Math.max(0, callsMadeThisMonth - FREE_TIER_MONTHLY);
  const hardCapReached = monthlyLimit != null && monthlyLimit > 0 && callsMadeThisMonth >= monthlyLimit;
  const requiresPaidConfirmation = callsMadeThisMonth >= FREE_TIER_MONTHLY;

  return {
    monthKey: usageState.monthKey,
    callsMadeThisMonth,
    estimatedFreeTierMonthly: FREE_TIER_MONTHLY,
    estimatedFreeRemaining,
    estimatedOverageCalls,
    monthlyLookupLimit: monthlyLimit,
    hardCapReached,
    requiresPaidConfirmation,
    rentCastUsageApiAvailable: false,
  };
}

export function resetRentCastUsageForTests() {
  usageState = { monthKey: currentMonthKey(), apiCallsThisMonth: 0 };
}
