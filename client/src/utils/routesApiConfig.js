/** Client defaults — server enforces caps; keep in sync with server/services/routesApiConfig.js */
export const ROUTES_API_DEFAULTS = {
  enableRoadTiming: true,
  prefilterTopRoutes: 5,
  maxElementsPerSearch: 250,
  maxElementsPerRoute: 50,
  maxElementsPerDay: 1000,
  polylineOnDetailOnly: true,
};

export function getRoutesApiConfig() {
  return { ...ROUTES_API_DEFAULTS };
}

export function createSearchElementBudget(config = getRoutesApiConfig()) {
  return {
    maxElementsPerSearch: config.maxElementsPerSearch,
    maxElementsPerRoute: config.maxElementsPerRoute,
    remainingSearchElements: config.maxElementsPerSearch,
    elementsRequested: 0,
    elementsFromCache: 0,
    routesRoadScored: 0,
    routesEstimatedOnly: 0,
  };
}
