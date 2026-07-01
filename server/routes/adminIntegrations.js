import express from 'express';
import { requireActiveUser, requireAdmin } from '../security/internalAccess.js';
import { getCurrentUserContext } from '../services/currentUserContext.js';
import {
  createIntegrationProfile,
  getIntegrationProfile,
  listIntegrationProfiles,
  updateIntegrationProfile,
} from '../services/organizationIntegrations.js';
import { getIntegrationHealth } from '../services/integrationResolver.js';
import { getOrganizationById } from '../services/organizationUsers.js';

const router = express.Router();

router.get('/', requireAdmin, (req, res) => {
  const context = getCurrentUserContext(req);
  const profiles = listIntegrationProfiles({ organizationId: context.organizationId });
  res.json({
    organization: getOrganizationById(context.organizationId),
    profiles,
    count: profiles.length,
  });
});

router.get('/me', requireActiveUser, (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    return res.json({
      profile: getIntegrationProfile(context.userId),
    });
  } catch (err) {
    return res.status(err.code === 'NOT_FOUND' ? 404 : 500).json({
      error: err.message || 'Failed to load integration profile',
      code: err.code || 'LOAD_INTEGRATION_PROFILE_FAILED',
    });
  }
});

router.get('/me/health', requireActiveUser, (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    return res.json({
      health: getIntegrationHealth(context),
    });
  } catch (err) {
    return res.status(err.code === 'NOT_FOUND' ? 404 : 500).json({
      error: err.message || 'Failed to load integration health',
      code: err.code || 'LOAD_INTEGRATION_HEALTH_FAILED',
    });
  }
});

router.get('/:userId', requireAdmin, (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const profile = getIntegrationProfile(req.params.userId);
    if (!profile || profile.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'Integration profile not found' });
    }
    return res.json({ profile });
  } catch (err) {
    return res.status(err.code === 'NOT_FOUND' ? 404 : 500).json({
      error: err.message || 'Failed to load integration profile',
      code: err.code || 'LOAD_INTEGRATION_PROFILE_FAILED',
    });
  }
});

router.get('/:userId/health', requireAdmin, (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const targetContext = {
      ...context,
      userId: req.params.userId,
      integrationProfile: getIntegrationProfile(req.params.userId),
    };
    const health = getIntegrationHealth(targetContext);
    if (targetContext.integrationProfile.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'Integration profile not found' });
    }
    return res.json({ health });
  } catch (err) {
    return res.status(err.code === 'NOT_FOUND' ? 404 : 500).json({
      error: err.message || 'Failed to load integration health',
      code: err.code || 'LOAD_INTEGRATION_HEALTH_FAILED',
    });
  }
});

router.post('/', requireAdmin, (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const userId = req.body?.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.', code: 'VALIDATION_ERROR' });
    }
    const profile = createIntegrationProfile(userId, req.body, context.userId);
    if (profile.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'Integration profile not found' });
    }
    return res.status(201).json({ profile });
  } catch (err) {
    const status = err.code === 'VALIDATION_ERROR' ? 400 : err.code === 'DUPLICATE_PROFILE' ? 409 : 500;
    return res.status(status).json({
      error: err.message || 'Failed to create integration profile',
      code: err.code || 'CREATE_INTEGRATION_PROFILE_FAILED',
    });
  }
});

router.put('/:userId', requireAdmin, (req, res) => {
  try {
    const context = getCurrentUserContext(req);
    const profile = updateIntegrationProfile(req.params.userId, req.body, context.userId);
    if (!profile || profile.organizationId !== context.organizationId) {
      return res.status(404).json({ error: 'Integration profile not found' });
    }
    return res.json({ profile });
  } catch (err) {
    const status = err.code === 'VALIDATION_ERROR' ? 400 : 500;
    return res.status(status).json({
      error: err.message || 'Failed to update integration profile',
      code: err.code || 'UPDATE_INTEGRATION_PROFILE_FAILED',
    });
  }
});

export default router;
