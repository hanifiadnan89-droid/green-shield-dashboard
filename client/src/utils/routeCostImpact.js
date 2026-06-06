import { DEFAULT_ROUTE_ECONOMICS, getCostEfficiencyLabel } from '../pages/CRMPreview/components/RouteFinder/routeEconomics.js';

/**
 * Estimate fuel and labor cost for added route miles/minutes.
 * @param {{ addedMiles?: number, addedDriveMinutes?: number }} params
 * @param {typeof DEFAULT_ROUTE_ECONOMICS} [economics]
 */
export function computeRouteCostImpact(
  { addedMiles = 0, addedDriveMinutes = 0 },
  economics = DEFAULT_ROUTE_ECONOMICS,
) {
  const miles = Math.max(0, Number(addedMiles) || 0);
  const minutes = Math.max(0, Number(addedDriveMinutes) || 0);

  const mpg = economics.averageMilesPerGallon || 18;
  const fuelCost = (miles / mpg) * (economics.fuelCostPerGallon || 0);
  const vehicleCost = miles * (economics.defaultVehicleCostPerMile || 0);
  const laborCost = (minutes / 60) * (economics.technicianLaborCostPerHour || 0);
  const overheadCost = (minutes / 60) * (economics.overheadCostPerHour || 0);

  const addedFuelCost = Math.round((fuelCost + vehicleCost) * 100) / 100;
  const addedLaborCost = Math.round((laborCost + overheadCost) * 100) / 100;
  const estimatedAddedCost = Math.round((addedFuelCost + addedLaborCost) * 100) / 100;

  const efficiency = getCostEfficiencyLabel(estimatedAddedCost);

  return {
    addedMiles: Math.round(miles * 10) / 10,
    addedDriveMinutes: Math.round(minutes),
    addedFuelCost,
    addedLaborCost,
    estimatedAddedCost,
    efficiencyLabel: efficiency.label,
    efficiencyKey: efficiency.key,
    summary: `~$${estimatedAddedCost.toFixed(2)} estimated added cost`,
    detail: `Fuel: ~$${addedFuelCost.toFixed(2)} · Labor: ~$${addedLaborCost.toFixed(2)}`,
    isEstimated: true,
  };
}
