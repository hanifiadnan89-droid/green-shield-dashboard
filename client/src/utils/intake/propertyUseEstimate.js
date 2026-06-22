const COMMERCIAL_TYPES = new Set([
  'establishment',
  'point_of_interest',
  'store',
  'shopping_mall',
  'lodging',
  'restaurant',
  'food',
  'finance',
  'health',
  'school',
  'church',
  'hospital',
  'university',
  'local_government_office',
  'city_hall',
  'courthouse',
  'lawyer',
  'real_estate_agency',
  'car_dealer',
  'car_repair',
  'gas_station',
  'supermarket',
  'grocery_or_supermarket',
  'warehouse',
  'storage',
  'industrial',
  'factory',
  'office',
]);

const RESIDENTIAL_TYPES = new Set([
  'premise',
  'subpremise',
  'street_address',
  'residential',
  'home_goods_store',
]);

/**
 * Estimate residential vs commercial from Google place types.
 * @param {string[]} types
 * @returns {{ estimate: 'Residential'|'Commercial'|'Unknown', confidence: 'high'|'medium'|'low' }}
 */
export function estimatePropertyUse(types = []) {
  const normalized = types.map((t) => String(t).toLowerCase());
  const hasCommercial = normalized.some((t) => COMMERCIAL_TYPES.has(t));
  const hasResidential = normalized.some((t) => RESIDENTIAL_TYPES.has(t));

  if (hasCommercial && !hasResidential) {
    return { estimate: 'Commercial', confidence: 'medium' };
  }
  if (hasResidential && !hasCommercial) {
    return { estimate: 'Residential', confidence: 'medium' };
  }
  if (hasCommercial && hasResidential) {
    return { estimate: 'Commercial', confidence: 'low' };
  }
  return { estimate: 'Unknown', confidence: 'low' };
}
