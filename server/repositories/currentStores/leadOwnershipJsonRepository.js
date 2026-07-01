import * as LeadOwnership from '../../services/leadOwnership.js';
import {
  assertLeadOwnershipRepository,
  LEAD_OWNERSHIP_ROW_NUMBER_COMPATIBILITY_NOTE,
} from '../contracts/LeadOwnershipRepository.js';

export function createLeadOwnershipRepository({ service = LeadOwnership } = {}) {
  return assertLeadOwnershipRepository({
    compatibilityIdentity: 'rowNumber',
    compatibilityNote: LEAD_OWNERSHIP_ROW_NUMBER_COMPATIBILITY_NOTE,
    getLeadOwnership: (leadOrRowNumber, context) => service.resolveLeadOwner(leadOrRowNumber, context),
    getOwnerForLead: (leadOrRowNumber, context) => service.getLeadOwner(leadOrRowNumber, context),
    setLeadOwnership: (leadOrRowNumber, context, overrides) =>
      service.assignLeadOwner(leadOrRowNumber, context, overrides),
    transferLeadOwnership: ({ leadOrRowNumber, nextOwnerUserId, context } = {}) =>
      service.transferLeadOwnership(leadOrRowNumber, nextOwnerUserId, context),
    validateLeadOwnership: (ownership) => service.validateLeadOwnership(ownership),
    listOwnershipRecords: () => service.listLeadOwnershipRecords(),
    listOwnershipByUser: (userId) =>
      service.listLeadOwnershipRecords().filter((record) => record.ownerUserId === userId),
    decorateLeadOwnership: (lead, context) => service.decorateLeadOwnership(lead, context),
    updateLeadOwnershipMetadata: (rowNumber, context) =>
      service.updateLeadOwnershipMetadata(rowNumber, context),
    isLeadOwnedByUser: (context, leadOrRowNumber) => service.isLeadOwnedByUser(context, leadOrRowNumber),
  });
}

