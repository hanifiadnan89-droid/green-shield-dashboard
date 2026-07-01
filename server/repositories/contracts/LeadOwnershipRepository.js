export const LEAD_OWNERSHIP_REPOSITORY_METHODS = [
  'getLeadOwnership',
  'getOwnerForLead',
  'setLeadOwnership',
  'transferLeadOwnership',
  'validateLeadOwnership',
  'listOwnershipRecords',
  'listOwnershipByUser',
  'decorateLeadOwnership',
  'updateLeadOwnershipMetadata',
  'isLeadOwnedByUser',
];

export const LEAD_OWNERSHIP_ROW_NUMBER_COMPATIBILITY_NOTE =
  'Lead ownership repositories accept rowNumber as a temporary compatibility identity until lead_id backfill exists.';

export function assertLeadOwnershipRepository(repository) {
  for (const method of LEAD_OWNERSHIP_REPOSITORY_METHODS) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`LeadOwnershipRepository missing method: ${method}`);
    }
  }
  return repository;
}

