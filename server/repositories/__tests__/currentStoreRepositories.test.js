import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';
import { createAIUsageRepository } from '../currentStores/aiUsageJsonRepository.js';
import { createErrorLogRepository } from '../currentStores/errorLogJsonRepository.js';
import { createIntegrationProfileRepository } from '../currentStores/integrationProfileJsonRepository.js';
import { createLeadOwnershipRepository } from '../currentStores/leadOwnershipJsonRepository.js';
import { createUserRepository } from '../currentStores/userJsonRepository.js';
import { createRepositories } from '../repositoryRegistry.js';
import { AI_USAGE_REPOSITORY_METHODS } from '../contracts/AIUsageRepository.js';
import { ERROR_LOG_REPOSITORY_METHODS } from '../contracts/ErrorLogRepository.js';
import { INTEGRATION_PROFILE_REPOSITORY_METHODS } from '../contracts/IntegrationProfileRepository.js';
import {
  LEAD_OWNERSHIP_REPOSITORY_METHODS,
  LEAD_OWNERSHIP_ROW_NUMBER_COMPATIBILITY_NOTE,
} from '../contracts/LeadOwnershipRepository.js';
import { USER_REPOSITORY_METHODS } from '../contracts/UserRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoriesDir = path.resolve(__dirname, '..');

function expectMethods(repository, methods) {
  for (const method of methods) {
    expect(repository[method], method).toEqual(expect.any(Function));
  }
}

describe('current-store repositories', () => {
  it('AI usage repository exposes the contract and delegates to the current service', () => {
    const service = {
      recordAIUsage: vi.fn((entry) => ({ id: 'ai_usage_1', ...entry })),
      listAIUsage: vi.fn(() => [{ id: 'ai_usage_1' }]),
      summarizeAIUsage: vi.fn(() => ({ total: 1 })),
      getSafeAIUsageLogStorageStatus: vi.fn(() => ({ writeSafe: true })),
    };
    const repository = createAIUsageRepository({ service });

    expectMethods(repository, AI_USAGE_REPOSITORY_METHODS);
    expect(repository.recordUsage({ feature: 'test' })).toMatchObject({ feature: 'test' });
    expect(repository.listUsage({ limit: 1 })).toEqual([{ id: 'ai_usage_1' }]);
    expect(repository.summarizeUsage({})).toEqual({ total: 1 });
    expect(repository.getStorageStatus()).toEqual({ writeSafe: true });
    expect(service.recordAIUsage).toHaveBeenCalledWith({ feature: 'test' });
  });

  it('Error Center repository exposes the contract and delegates to the current service', () => {
    const service = {
      createError: vi.fn(() => ({ id: 'err_1' })),
      listErrors: vi.fn(() => ({ errors: [], total: 0 })),
      getErrorDetail: vi.fn(() => ({ id: 'err_1' })),
      updateErrorStatus: vi.fn(() => ({ status: 'ignored' })),
      markErrorResolved: vi.fn(() => ({ status: 'resolved' })),
      archiveError: vi.fn(() => ({ status: 'archived' })),
      summarizeErrors: vi.fn(() => ({ total: 1 })),
      findSimilarErrors: vi.fn(() => []),
      setErrorAnalysis: vi.fn(() => ({ aiAnalysis: {} })),
      getErrorLogStorageStatus: vi.fn(() => ({ backend: 'file', writeSafe: true })),
    };
    const repository = createErrorLogRepository({ service });

    expectMethods(repository, ERROR_LOG_REPOSITORY_METHODS);
    expect(repository.createError({ message: 'boom' })).toEqual({ id: 'err_1' });
    expect(repository.getErrorById('err_1')).toEqual({ id: 'err_1' });
    expect(repository.getStorageStatus()).toMatchObject({ backend: 'file', writeSafe: true });
    expect(service.createError).toHaveBeenCalledWith({ message: 'boom' });
  });

  it('user repository exposes the contract and delegates to organizationUsers', () => {
    const service = {
      listOrganizations: vi.fn(() => []),
      getOrganizationById: vi.fn(() => ({ id: 'org_1' })),
      getDefaultOrganization: vi.fn(() => ({ id: 'org_1' })),
      listUsers: vi.fn(() => []),
      getUserById: vi.fn(() => ({ id: 'user_1' })),
      getUserRecordById: vi.fn(() => ({ id: 'user_1', authUsername: 'ah' })),
      getUserByAuthUsername: vi.fn(() => ({ id: 'user_1' })),
      getUserRecordByAuthUsername: vi.fn(() => ({ id: 'user_1', authUsername: 'ah' })),
      resolveCurrentUserContextFromAuthUsername: vi.fn(() => ({ userId: 'user_1' })),
      createUser: vi.fn(() => ({ id: 'user_2' })),
      updateUser: vi.fn(() => ({ id: 'user_1' })),
      deactivateUser: vi.fn(() => ({ status: 'inactive' })),
      reactivateUser: vi.fn(() => ({ status: 'active' })),
      ensureInternalTenancy: vi.fn(() => ({ users: [] })),
      getInternalTenancySnapshot: vi.fn(() => ({ users: [] })),
    };
    const repository = createUserRepository({ service });

    expectMethods(repository, USER_REPOSITORY_METHODS);
    expect(repository.findUserByAuthUsername('ah')).toEqual({ id: 'user_1' });
    expect(repository.createUser({ name: 'Rep' }, 'admin')).toEqual({ id: 'user_2' });
    expect(service.createUser).toHaveBeenCalledWith({ name: 'Rep' }, 'admin');
  });

  it('integration profile repository exposes the contract and delegates to organizationIntegrations', () => {
    const service = {
      listIntegrationProfiles: vi.fn(() => []),
      getIntegrationProfile: vi.fn(() => ({ userId: 'user_1' })),
      getIntegrationProfileRecord: vi.fn(() => ({ userId: 'user_1' })),
      createIntegrationProfile: vi.fn(() => ({ id: 'integration_1' })),
      updateIntegrationProfile: vi.fn(() => ({ id: 'integration_1' })),
      validateIntegrationProfile: vi.fn((profile) => profile),
      ensureOrganizationIntegrations: vi.fn(() => ({ profiles: [] })),
      getOrganizationIntegrationsSnapshot: vi.fn(() => ({ profiles: [] })),
    };
    const repository = createIntegrationProfileRepository({ service });

    expectMethods(repository, INTEGRATION_PROFILE_REPOSITORY_METHODS);
    expect(repository.getIntegrationProfileForUser('user_1')).toEqual({ userId: 'user_1' });
    expect(repository.updateIntegrationProfile('user_1', { gmail: {} }, 'admin')).toEqual({ id: 'integration_1' });
    expect(service.updateIntegrationProfile).toHaveBeenCalledWith('user_1', { gmail: {} }, 'admin');
  });

  it('lead ownership repository exposes rowNumber compatibility and delegates to leadOwnership', () => {
    const service = {
      resolveLeadOwner: vi.fn(() => ({ rowNumber: '2', ownerUserId: 'user_1' })),
      getLeadOwner: vi.fn(() => ({ rowNumber: '2', ownerUserId: 'user_1' })),
      assignLeadOwner: vi.fn(() => ({ rowNumber: '2', ownerUserId: 'user_1' })),
      transferLeadOwnership: vi.fn(() => ({ rowNumber: '2', ownerUserId: 'user_2' })),
      validateLeadOwnership: vi.fn((ownership) => ownership),
      listLeadOwnershipRecords: vi.fn(() => [
        { rowNumber: '2', ownerUserId: 'user_1' },
        { rowNumber: '3', ownerUserId: 'user_2' },
      ]),
      decorateLeadOwnership: vi.fn((lead) => lead),
      updateLeadOwnershipMetadata: vi.fn(() => ({ rowNumber: '2' })),
      isLeadOwnedByUser: vi.fn(() => true),
    };
    const repository = createLeadOwnershipRepository({ service });

    expectMethods(repository, LEAD_OWNERSHIP_REPOSITORY_METHODS);
    expect(repository.compatibilityIdentity).toBe('rowNumber');
    expect(repository.compatibilityNote).toBe(LEAD_OWNERSHIP_ROW_NUMBER_COMPATIBILITY_NOTE);
    expect(repository.getLeadOwnership(2)).toEqual({ rowNumber: '2', ownerUserId: 'user_1' });
    expect(repository.listOwnershipByUser('user_1')).toEqual([{ rowNumber: '2', ownerUserId: 'user_1' }]);
    expect(repository.transferLeadOwnership({
      leadOrRowNumber: 2,
      nextOwnerUserId: 'user_2',
      context: { userId: 'admin' },
    })).toEqual({ rowNumber: '2', ownerUserId: 'user_2' });
  });

  it('repository registry returns all current-store repositories and supports overrides', () => {
    const fakeAIUsage = { recordUsage: vi.fn() };
    const repositories = createRepositories({ aiUsage: fakeAIUsage });

    expect(repositories.aiUsage).toBe(fakeAIUsage);
    expect(repositories.errorLog.createError).toEqual(expect.any(Function));
    expect(repositories.users.listUsers).toEqual(expect.any(Function));
    expect(repositories.integrationProfiles.listIntegrationProfiles).toEqual(expect.any(Function));
    expect(repositories.leadOwnership.getLeadOwnership).toEqual(expect.any(Function));
  });

  it('current-store repositories do not import dbClient or pg', () => {
    const files = fs.readdirSync(path.join(repositoriesDir, 'currentStores'))
      .filter((file) => file.endsWith('.js'));

    for (const file of files) {
      const source = fs.readFileSync(path.join(repositoriesDir, 'currentStores', file), 'utf8');
      expect(source).not.toMatch(/from ['"].*dbClient\.js['"]/);
      expect(source).not.toMatch(/from ['"]pg['"]/);
      expect(source).not.toMatch(/from ['"].*services\/db\//);
    }
  });
});

