/**
 * Route economics defaults for fuel and labor cost impact estimates.
 * Values are configurable; defaults are conservative placeholders.
 */

export const DEFAULT_ROUTE_ECONOMICS = {
  fuelCostPerGallon: 3.5,
  averageMilesPerGallon: 18,
  technicianLaborCostPerHour: 25,
  defaultVehicleCostPerMile: 0,
  overheadCostPerHour: 0,
};

/**
 * Cost efficiency labels based on total estimated added cost.
 * @param {number} totalCost
 */
export function getCostEfficiencyLabel(totalCost) {
  if (totalCost < 5) return { key: 'excellent', label: 'Low-cost insertion' };
  if (totalCost < 12) return { key: 'good', label: 'Efficient add-on' };
  if (totalCost < 25) return { key: 'fair', label: 'Moderate detour cost' };
  return { key: 'poor', label: 'Expensive detour' };
}
